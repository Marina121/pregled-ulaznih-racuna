import type { Invoice, LineItem } from '../types/invoice'
import { FIELD_META, type FieldKey } from './fields'
import { isValidAccount } from './bankAccounts'
import { isValidTaxId, isValidVatId, sameCompany } from './taxIds'

export type Severity = 'error' | 'warn'
export type Edits = Record<string, unknown>

export interface Issue {
  /** Stable key, so "checked" survives recomputation. */
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

const str = (x: unknown): string | null => (typeof x === 'string' && x.trim() !== '' ? x : null)
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null)
const isEmpty = (x: unknown) => x === null || x === undefined || x === '' || (Array.isArray(x) && x.length === 0)
const norm = (s: string | null) => (s ?? '').toLowerCase().replace(/\s+/g, '')

// Line item numbers can be verified by arithmetic: quantity × price gives the total, with or
// without VAT. If they match, they were read correctly, however unsure the system was.
function lineMathOk(l: LineItem): boolean {
  const q = num(l.quantity.value), p = num(l.unitPrice.value), t = num(l.lineTotal.value), r = num(l.vatRate.value)
  if (q === null || p === null || t === null) return false
  return Math.abs(q * p - t) <= TOLERANCE || (r !== null && Math.abs(q * p * (1 + r / 100) - t) <= TOLERANCE)
}

const LINE_NUMBERS = ['quantity', 'unitPrice', 'vatRate', 'lineTotal'] as const

/**
 * Whether a line item cell needs checking. Numbers only: the description and unit aren't booked,
 * so their low confidence is no reason for a warning.
 */
export function lineCellUncertain(l: LineItem, key: keyof LineItem): boolean {
  if (!(LINE_NUMBERS as readonly string[]).includes(key)) return false
  const c = l[key]
  return c.value !== null && c.confidence < LOW_CONFIDENCE && !lineMathOk(l)
}

export function valueOf(inv: Invoice, edits: Edits | undefined, key: FieldKey): unknown {
  const e = edits?.[key]
  return e !== undefined ? e : inv.fields[key].value
}

function vendorKey(inv: Invoice, edits: Edits | undefined) {
  return norm(str(valueOf(inv, edits, 'vendorTaxId')) ?? str(valueOf(inv, edits, 'vendorName')))
}

function checkInvoice(inv: Invoice, all: Invoice[], allEdits: Record<string, Edits>, rejected: Set<string>): Issue[] {
  const edits = allEdits[inv.id]
  const v = (k: FieldKey) => valueOf(inv, edits, k)
  const issues: Issue[] = []

  // Bank account numbers have check digits, so the check decides, not the read confidence:
  // a misread digit would almost certainly break the check.
  const accounts = (v('bankAccounts') as string[] | null) ?? []
  const badAccounts = accounts.filter((a) => !isValidAccount(a))
  // Same for tax IDs and VAT numbers: a valid check digit is better evidence than confidence.
  const checkDigitOk = (k: FieldKey): boolean => {
    const x = str(v(k))
    if (x === null) return false
    if (k === 'vendorTaxId' || k === 'buyerTaxId') return isValidTaxId(x)
    if (k === 'vendorVatId') return isValidVatId(x)
    if (k === 'bankAccounts') return accounts.length > 0
    return false
  }

  // 1. Missing required field / low confidence.
  // A manually corrected field is no longer considered uncertain.
  for (const m of FIELD_META) {
    const f = inv.fields[m.key]
    const edited = edits?.[m.key] !== undefined
    if (isEmpty(v(m.key))) {
      if (m.required) issues.push({ key: `missing:${m.key}`, severity: 'error', fields: [m.key], message: 'Polje nije pročitano.' })
    } else if (!edited && f.confidence < LOW_CONFIDENCE && !checkDigitOk(m.key)) {
      issues.push({
        key: `conf:${m.key}`,
        severity: 'warn',
        fields: [m.key],
        message: `Niska pouzdanost čitanja (${Math.round(f.confidence * 100)}%).`,
      })
    }
  }

  // 2. Net + VAT must equal the total.
  const n = num(v('netAmount')), t = num(v('vatAmount')), tot = num(v('totalAmount'))
  if (n !== null && t !== null && tot !== null && Math.abs(n + t - tot) > TOLERANCE) {
    issues.push({
      key: 'math',
      severity: 'error',
      fields: ['netAmount', 'vatAmount', 'totalAmount'],
      message: `Osnovica + PDV = ${(n + t).toFixed(2)}, a ukupno je ${tot.toFixed(2)}.`,
    })
  }

  // 3. Sum of line items. Lines may include VAT or not, so it passes if it matches either.
  // An invoice can also have a discount (e.g. inv-006), so this is a warning, not an error.
  const lineSum = inv.lineItems.reduce((s, l) => s + (num(l.lineTotal.value) ?? 0), 0)
  if (inv.lineItems.length > 0 && n !== null && tot !== null && Math.abs(lineSum - n) > TOLERANCE && Math.abs(lineSum - tot) > TOLERANCE) {
    issues.push({
      key: 'linesSum',
      severity: 'warn',
      fields: [],
      message: `Zbroj stavki (${lineSum.toFixed(2)}) ne odgovara ni osnovici ni ukupnom iznosu. Ako račun ima rabat, to može biti u redu.`,
    })
  }
  const lowLineCells = inv.lineItems.reduce((s, l) => s + LINE_NUMBERS.filter((k) => lineCellUncertain(l, k)).length, 0)
  if (lowLineCells > 0) {
    issues.push({
      key: 'linesConf',
      severity: 'warn',
      fields: [],
      message:
        lowLineCells === 1
          ? 'Jedan iznos u stavkama nije sigurno pročitan i ne slaže se s izračunom (označen žuto).'
          : `${lowLineCells} iznosa u stavkama nisu sigurno pročitana i ne slažu se s izračunom (označeni žuto).`,
    })
  }

  // 4. Dates.
  const issue = str(v('issueDate')), supply = str(v('supplyDate')), due = str(v('dueDate'))
  if (issue && supply && supply > issue) {
    issues.push({ key: 'dates:supply', severity: 'warn', fields: ['supplyDate', 'issueDate'], message: 'Datum isporuke je nakon datuma računa.' })
  }
  if (issue && due && due < issue) {
    issues.push({ key: 'dates:due', severity: 'warn', fields: ['dueDate', 'issueDate'], message: 'Datum dospijeća je prije datuma računa.' })
  }

  // 5. The buyer must be the client whose invoices the accountant is handling.
  const buyerTax = str(v('buyerTaxId'))
  if (buyerTax && buyerTax !== inv.client.taxId) {
    issues.push({
      key: 'buyer',
      severity: 'error',
      fields: ['buyerTaxId', 'buyerName'],
      message: `ID broj kupca se razlikuje od klijenta (${inv.client.name}). Je li račun u pravoj mapi?`,
    })
  }

  // 6. Tax ID and VAT number: each has a check digit, so we know which one was misread.
  // A branch has its own tax ID but the company's VAT number, so only the "company" part is compared.
  const vTax = str(v('vendorTaxId')), vVat = str(v('vendorVatId')), bTax = str(v('buyerTaxId'))
  const badId = (k: FieldKey, label: string) =>
    issues.push({
      key: `checkdigit:${k}`,
      severity: 'error',
      fields: [k],
      message: `${label} nije ispravan: kontrolna znamenka ne odgovara. Neka znamenka je krivo pročitana.`,
    })
  if (vTax && !isValidTaxId(vTax)) badId('vendorTaxId', 'ID broj')
  if (vVat && !isValidVatId(vVat)) badId('vendorVatId', 'PDV broj')
  if (bTax && !isValidTaxId(bTax)) badId('buyerTaxId', 'ID broj')
  if (vTax && vVat && isValidTaxId(vTax) && isValidVatId(vVat) && !sameCompany(vTax, vVat)) {
    issues.push({
      key: 'vat-tax',
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
  const myVendor = vendorKey(inv, edits)
  const myNumber = norm(str(v('invoiceNumber')))
  for (const o of all) {
    // A rejected duplicate isn't booked, so it no longer threatens the original.
    if (o.id === inv.id || rejected.has(o.id) || vendorKey(o, allEdits[o.id]) !== myVendor || !myVendor) continue
    const oNumber = norm(str(valueOf(o, allEdits[o.id], 'invoiceNumber')))
    const oTotal = num(valueOf(o, allEdits[o.id], 'totalAmount'))
    if (myNumber && myNumber === oNumber) {
      issues.push({
        key: `dup:${o.id}`,
        severity: 'error',
        fields: [],
        message: `Mogući duplikat: isti dobavljač i broj računa kao ${o.id}.`,
        relatedId: o.id,
      })
    } else if (
      tot !== null &&
      oTotal !== null &&
      Math.abs(tot - oTotal) < 0.005 &&
      // Same amount on a different date is a regular delivery (e.g. the same goods every two weeks,
      // inv-001 and inv-012), not a duplicate. Only suspicious if the date matches too: the number
      // may have been misread.
      issue !== null &&
      issue === str(valueOf(o, allEdits[o.id], 'issueDate'))
    ) {
      issues.push({
        key: `dup:${o.id}`,
        severity: 'warn',
        fields: [],
        message: `Isti dobavljač, iznos i datum kao ${o.id}, ali drugi broj računa. Duplikat ili dvije isporuke isti dan?`,
        relatedId: o.id,
      })
    }
  }

  return issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1))
}

export function computeIssues(
  invoices: Invoice[],
  edits: Record<string, Edits>,
  rejected: Set<string> = new Set(),
): Record<string, Issue[]> {
  return Object.fromEntries(invoices.map((i) => [i.id, checkInvoice(i, invoices, edits, rejected)]))
}
