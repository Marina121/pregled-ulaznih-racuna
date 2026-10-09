import type { Invoice, LineItem } from '../types/invoice'
import { FIELD_META, type FieldKey } from './fields'
import { isValidAccount } from './bankAccounts'
import { isValidTaxId, isValidVatId, sameCompany } from './taxIds'

export type Severity = 'error' | 'warn'
export type Edits = Record<string, unknown>

export interface Issue {
  /**
   * Stable key, so "checked" survives recomputation. It includes the values the issue is about:
   * if they change (e.g. the total is edited again), it's a new issue and needs checking again.
   */
  key: string
  severity: Severity
  /** Fields the issue applies to. Empty = an issue with the whole invoice. */
  fields: FieldKey[]
  message: string
  /** The other invoice the issue refers to (possible duplicate), so it opens in one click. */
  relatedId?: string
}

export const LOW_CONFIDENCE = 0.8
const TOLERANCE = 0.02

const asText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null
const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null
const isEmpty = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === '' ||
  (Array.isArray(value) && value.length === 0)
const normalize = (text: string | null) => (text ?? '').toLowerCase().replace(/\s+/g, '')
// A real date in YYYY-MM-DD form. 2022-02-30 is rejected (Date would roll it over to March),
// and so is 2022-13-01 (an invalid Date, whose toISOString would throw).
const isIsoDate = (text: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const date = new Date(`${text}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text)
}

// Line item numbers can be verified by arithmetic: quantity × price gives the total, with or
// without VAT. If they match, they were read correctly, however unsure the system was.
function lineMathOk(line: LineItem): boolean {
  const quantity = asNumber(line.quantity.value),
    unitPrice = asNumber(line.unitPrice.value),
    lineTotal = asNumber(line.lineTotal.value),
    vatRate = asNumber(line.vatRate.value)
  if (quantity === null || unitPrice === null || lineTotal === null) return false
  const withoutVat = quantity * unitPrice
  return (
    Math.abs(withoutVat - lineTotal) <= TOLERANCE ||
    (vatRate !== null && Math.abs(withoutVat * (1 + vatRate / 100) - lineTotal) <= TOLERANCE)
  )
}

const LINE_NUMBERS = ['quantity', 'unitPrice', 'vatRate', 'lineTotal'] as const

/**
 * Whether a line item cell needs checking. Numbers only: the description and unit aren't booked,
 * so their low confidence is no reason for a warning.
 */
export function lineCellUncertain(line: LineItem, key: keyof LineItem): boolean {
  if (!(LINE_NUMBERS as readonly string[]).includes(key)) return false
  const cell = line[key]
  return cell.value !== null && cell.confidence < LOW_CONFIDENCE && !lineMathOk(line)
}

export function valueOf(invoice: Invoice, edits: Edits | undefined, key: FieldKey): unknown {
  const edited = edits?.[key]
  return edited !== undefined ? edited : invoice.fields[key].value
}

function vendorKey(invoice: Invoice, edits: Edits | undefined) {
  return normalize(
    asText(valueOf(invoice, edits, 'vendorTaxId')) ?? asText(valueOf(invoice, edits, 'vendorName')),
  )
}

function checkInvoice(
  invoice: Invoice,
  allInvoices: Invoice[],
  allEdits: Record<string, Edits>,
  rejected: Set<string>,
): Issue[] {
  const edits = allEdits[invoice.id]
  // The field's current value: the accountant's correction if there is one, else what was read.
  const current = (key: FieldKey) => valueOf(invoice, edits, key)
  const issues: Issue[] = []

  // Bank account numbers have check digits, so the check decides, not the read confidence:
  // a misread digit would almost certainly break the check.
  const accounts = (current('bankAccounts') as string[] | null) ?? []
  const badAccounts = accounts.filter((account) => !isValidAccount(account))
  // Same for tax IDs and VAT numbers: a valid check digit is better evidence than confidence.
  const checkDigitOk = (key: FieldKey): boolean => {
    // Bank accounts are a list, not text, so they're handled before asText() below. When there
    // are any, check 7 decides (valid -> nothing, invalid -> error), so confidence is never shown.
    if (key === 'bankAccounts') return accounts.length > 0
    const text = asText(current(key))
    if (text === null) return false
    if (key === 'vendorTaxId' || key === 'buyerTaxId') return isValidTaxId(text)
    if (key === 'vendorVatId') return isValidVatId(text)
    return false
  }

  // 1. Missing required field / low confidence.
  // A manually corrected field is no longer considered uncertain.
  for (const field of FIELD_META) {
    const read = invoice.fields[field.key]
    const edited = edits?.[field.key] !== undefined
    if (isEmpty(current(field.key))) {
      if (field.required)
        issues.push({
          key: `missing:${field.key}`,
          severity: 'error',
          fields: [field.key],
          message: 'Polje nije pročitano.',
        })
    } else if (!edited && read.confidence < LOW_CONFIDENCE && !checkDigitOk(field.key)) {
      issues.push({
        key: `conf:${field.key}`,
        severity: 'warn',
        fields: [field.key],
        message: `Niska pouzdanost čitanja (${Math.round(read.confidence * 100)}%).`,
      })
    }
  }

  // 1b. A value outside the allowed options (e.g. the reader returned "KM" for currency).
  for (const field of FIELD_META) {
    const text = asText(current(field.key))
    if (field.options && text !== null && !field.options.some((option) => option.value === text)) {
      issues.push({
        key: `invalid:${field.key}:${text}`,
        severity: 'error',
        fields: [field.key],
        message: `Nepoznata vrijednost „${text}”. Odaberi s popisa.`,
      })
    }
  }

  // 2. Net + VAT must equal the total.
  const net = asNumber(current('netAmount')),
    vat = asNumber(current('vatAmount')),
    total = asNumber(current('totalAmount'))
  if (net !== null && vat !== null && total !== null && Math.abs(net + vat - total) > TOLERANCE) {
    issues.push({
      key: `math:${net}+${vat}=${total}`,
      severity: 'error',
      fields: ['netAmount', 'vatAmount', 'totalAmount'],
      message: `Osnovica + PDV = ${(net + vat).toFixed(2)}, a ukupno je ${total.toFixed(2)}.`,
    })
  }

  // 3. Sum of line items. Lines may include VAT or not, so it passes if it matches either.
  // An invoice can also have a discount (e.g. inv-006), so this is a warning, not an error.
  const lineSum = invoice.lineItems.reduce(
    (sum, line) => sum + (asNumber(line.lineTotal.value) ?? 0),
    0,
  )
  if (
    invoice.lineItems.length > 0 &&
    net !== null &&
    total !== null &&
    Math.abs(lineSum - net) > TOLERANCE &&
    Math.abs(lineSum - total) > TOLERANCE
  ) {
    issues.push({
      key: `linesSum:${lineSum.toFixed(2)}:${net}:${total}`,
      severity: 'warn',
      fields: [],
      message: `Zbroj stavki (${lineSum.toFixed(2)}) ne odgovara ni osnovici ni ukupnom iznosu. Ako račun ima rabat, to može biti u redu.`,
    })
  }
  const uncertainLineCells = invoice.lineItems.reduce(
    (count, line) => count + LINE_NUMBERS.filter((key) => lineCellUncertain(line, key)).length,
    0,
  )
  if (uncertainLineCells > 0) {
    issues.push({
      key: 'linesConf',
      severity: 'warn',
      fields: [],
      message:
        uncertainLineCells === 1
          ? 'Jedan iznos u stavkama nije sigurno pročitan i ne slaže se s izračunom (označen žuto).'
          : `${uncertainLineCells} iznosa u stavkama nisu sigurno pročitana i ne slažu se s izračunom (označeni žuto).`,
    })
  }

  // 4. Dates. Any text can be typed into a date field, so check the form first: "1.2.2022" would
  // break the comparisons below and couldn't be booked. Only valid dates are compared.
  const validDate = (key: FieldKey) => {
    const text = asText(current(key))
    if (text !== null && !isIsoDate(text)) {
      issues.push({
        key: `invalid:${key}:${text}`,
        severity: 'error',
        fields: [key],
        message: 'Datum mora biti u obliku GGGG-MM-DD, npr. 2022-01-11.',
      })
      return null
    }
    return text
  }
  const issueDate = validDate('issueDate'),
    supplyDate = validDate('supplyDate'),
    dueDate = validDate('dueDate')
  if (issueDate && supplyDate && supplyDate > issueDate) {
    issues.push({
      key: `dates:supply:${issueDate}:${supplyDate}`,
      severity: 'warn',
      fields: ['supplyDate', 'issueDate'],
      message: 'Datum isporuke je nakon datuma računa.',
    })
  }
  if (issueDate && dueDate && dueDate < issueDate) {
    issues.push({
      key: `dates:due:${issueDate}:${dueDate}`,
      severity: 'warn',
      fields: ['dueDate', 'issueDate'],
      message: 'Datum dospijeća je prije datuma računa.',
    })
  }

  // 5. The buyer must be the client whose invoices the accountant is handling.
  // Spaces don't matter ("4272 0804 50006" is the same number).
  const buyerTaxId = asText(current('buyerTaxId'))
  if (buyerTaxId && buyerTaxId.replace(/\s/g, '') !== invoice.client.taxId) {
    issues.push({
      key: `buyer:${buyerTaxId}`,
      severity: 'error',
      fields: ['buyerTaxId', 'buyerName'],
      message: `ID broj kupca se razlikuje od klijenta (${invoice.client.name}). Je li račun u pravoj mapi?`,
    })
  }

  // 6. Tax ID and VAT number: each has a check digit, so we know which one was misread.
  // A branch has its own tax ID but the company's VAT number, so only the "company" part is
  // compared.
  const vendorTaxId = asText(current('vendorTaxId')),
    vendorVatId = asText(current('vendorVatId'))
  const badCheckDigit = (key: FieldKey, label: string) =>
    issues.push({
      key: `checkdigit:${key}:${asText(current(key))}`,
      severity: 'error',
      fields: [key],
      message: `${label} nije ispravan: kontrolna znamenka ne odgovara. Neka znamenka je krivo pročitana.`,
    })
  if (vendorTaxId && !isValidTaxId(vendorTaxId)) badCheckDigit('vendorTaxId', 'ID broj')
  if (vendorVatId && !isValidVatId(vendorVatId)) badCheckDigit('vendorVatId', 'PDV broj')
  if (buyerTaxId && !isValidTaxId(buyerTaxId)) badCheckDigit('buyerTaxId', 'ID broj')
  if (
    vendorTaxId &&
    vendorVatId &&
    isValidTaxId(vendorTaxId) &&
    isValidVatId(vendorVatId) &&
    !sameCompany(vendorTaxId, vendorVatId)
  ) {
    issues.push({
      key: `vat-tax:${vendorTaxId}:${vendorVatId}`,
      severity: 'warn',
      fields: ['vendorTaxId', 'vendorVatId'],
      message: 'ID broj i PDV broj su ispravni, ali pripadaju različitim firmama.',
    })
  }

  // 7. Invalid bank account number: it can't be paid to.
  if (badAccounts.length > 0) {
    issues.push({
      key: `accounts:${badAccounts.join(',')}`,
      severity: 'error',
      fields: ['bankAccounts'],
      message:
        badAccounts.length === 1
          ? 'Broj označen s ✗ nije ispravan: nedostaje znamenka ili je neka krivo pročitana.'
          : 'Brojevi označeni s ✗ nisu ispravni: nedostaje znamenka ili je neka krivo pročitana.',
    })
  }

  // 8. Possible duplicates: they don't block, but require a deliberate decision.
  const myVendor = vendorKey(invoice, edits)
  const myNumber = normalize(asText(current('invoiceNumber')))
  for (const other of allInvoices) {
    const otherEdits = allEdits[other.id]
    // A rejected duplicate isn't booked, so it no longer threatens the original.
    if (
      other.id === invoice.id ||
      rejected.has(other.id) ||
      vendorKey(other, otherEdits) !== myVendor ||
      !myVendor
    )
      continue
    const otherNumber = normalize(asText(valueOf(other, otherEdits, 'invoiceNumber')))
    const otherTotal = asNumber(valueOf(other, otherEdits, 'totalAmount'))
    if (myNumber && myNumber === otherNumber) {
      issues.push({
        key: `dup:${other.id}`,
        severity: 'error',
        fields: [],
        message: `Mogući duplikat: isti dobavljač i broj računa kao ${other.id}.`,
        relatedId: other.id,
      })
    } else if (
      total !== null &&
      otherTotal !== null &&
      Math.abs(total - otherTotal) < 0.005 &&
      // Same amount on a different date is a regular delivery (e.g. the same goods every two weeks,
      // inv-001 and inv-012), not a duplicate. Only suspicious if the date matches too: the number
      // may have been misread.
      issueDate !== null &&
      issueDate === asText(valueOf(other, otherEdits, 'issueDate'))
    ) {
      issues.push({
        key: `dup:${other.id}`,
        severity: 'warn',
        fields: [],
        message: `Isti dobavljač, iznos i datum kao ${other.id}, ali drugi broj računa. Duplikat ili dvije isporuke isti dan?`,
        relatedId: other.id,
      })
    }
  }

  // Errors first, then warnings.
  return issues.sort((first, second) =>
    first.severity === second.severity ? 0 : first.severity === 'error' ? -1 : 1,
  )
}

export function computeIssues(
  invoices: Invoice[],
  edits: Record<string, Edits>,
  rejected: Set<string> = new Set(),
): Record<string, Issue[]> {
  return Object.fromEntries(
    invoices.map((invoice) => [invoice.id, checkInvoice(invoice, invoices, edits, rejected)]),
  )
}
