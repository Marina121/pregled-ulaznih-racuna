import type { Invoice } from '../types/invoice'
import { FIELD_META, type FieldKey } from './fields'

export type Severity = 'error' | 'warn'
export type Edits = Record<string, unknown>

export interface Issue {
  /** Stabilan ključ, da "provjereno" preživi ponovno računanje. */
  key: string
  severity: Severity
  /** Polja na koja se problem odnosi. Prazno = problem cijelog računa. */
  fields: FieldKey[]
  message: string
}

export const LOW_CONFIDENCE = 0.8
const TOLERANCE = 0.02

const str = (x: unknown): string | null => (typeof x === 'string' && x.trim() !== '' ? x : null)
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null)
const isEmpty = (x: unknown) => x === null || x === undefined || x === '' || (Array.isArray(x) && x.length === 0)
const norm = (s: string | null) => (s ?? '').toLowerCase().replace(/\s+/g, '')

export function valueOf(inv: Invoice, edits: Edits | undefined, key: FieldKey): unknown {
  const e = edits?.[key]
  return e !== undefined ? e : inv.fields[key].value
}

function vendorKey(inv: Invoice, edits: Edits | undefined) {
  return norm(str(valueOf(inv, edits, 'vendorTaxId')) ?? str(valueOf(inv, edits, 'vendorName')))
}

function checkInvoice(inv: Invoice, all: Invoice[], allEdits: Record<string, Edits>): Issue[] {
  const edits = allEdits[inv.id]
  const v = (k: FieldKey) => valueOf(inv, edits, k)
  const issues: Issue[] = []

  // 1. Nedostaje obavezno polje / niska pouzdanost.
  // Ručno ispravljeno polje se više ne smatra nesigurnim.
  for (const m of FIELD_META) {
    const f = inv.fields[m.key]
    const edited = edits?.[m.key] !== undefined
    if (isEmpty(v(m.key))) {
      if (m.required) issues.push({ key: `missing:${m.key}`, severity: 'error', fields: [m.key], message: 'Polje nije pročitano.' })
    } else if (!edited && f.confidence < LOW_CONFIDENCE) {
      issues.push({
        key: `conf:${m.key}`,
        severity: 'warn',
        fields: [m.key],
        message: `Niska pouzdanost čitanja (${Math.round(f.confidence * 100)}%).`,
      })
    }
  }

  // 2. Osnovica + PDV mora dati ukupno.
  const n = num(v('netAmount')), t = num(v('vatAmount')), tot = num(v('totalAmount'))
  if (n !== null && t !== null && tot !== null && Math.abs(n + t - tot) > TOLERANCE) {
    issues.push({
      key: 'math',
      severity: 'error',
      fields: ['netAmount', 'vatAmount', 'totalAmount'],
      message: `Osnovica + PDV = ${(n + t).toFixed(2)}, a ukupno je ${tot.toFixed(2)}.`,
    })
  }

  // 3. Zbroj stavki. Stavke mogu biti s PDV-om ili bez, pa prolazi ako odgovara bilo jednom.
  // Na računu može biti i rabat (npr. inv-006), zato je ovo upozorenje, a ne greška.
  const lineSum = inv.lineItems.reduce((s, l) => s + (num(l.lineTotal.value) ?? 0), 0)
  if (inv.lineItems.length > 0 && n !== null && tot !== null && Math.abs(lineSum - n) > TOLERANCE && Math.abs(lineSum - tot) > TOLERANCE) {
    issues.push({
      key: 'linesSum',
      severity: 'warn',
      fields: [],
      message: `Zbroj stavki (${lineSum.toFixed(2)}) ne odgovara ni osnovici ni ukupnom iznosu. Ako račun ima rabat, to može biti u redu.`,
    })
  }
  const lowLineCells = inv.lineItems.flatMap((l) => Object.values(l)).filter((c) => c.value !== null && c.confidence < LOW_CONFIDENCE).length
  if (lowLineCells > 0) {
    issues.push({ key: 'linesConf', severity: 'warn', fields: [], message: `${lowLineCells} polja u stavkama imaju nisku pouzdanost.` })
  }

  // 4. Datumi.
  const issue = str(v('issueDate')), supply = str(v('supplyDate')), due = str(v('dueDate'))
  if (issue && supply && supply > issue) {
    issues.push({ key: 'dates:supply', severity: 'warn', fields: ['supplyDate', 'issueDate'], message: 'Datum isporuke je nakon datuma računa.' })
  }
  if (issue && due && due < issue) {
    issues.push({ key: 'dates:due', severity: 'warn', fields: ['dueDate', 'issueDate'], message: 'Datum dospijeća je prije datuma računa.' })
  }

  // 5. Kupac mora biti klijent čije račune računovođa trenutno vodi.
  const buyerTax = str(v('buyerTaxId'))
  if (buyerTax && buyerTax !== inv.client.taxId) {
    issues.push({
      key: 'buyer',
      severity: 'error',
      fields: ['buyerTaxId', 'buyerName'],
      message: `ID broj kupca se razlikuje od klijenta (${inv.client.name}). Je li račun u pravoj mapi?`,
    })
  }

  // 6. PDV broj je ID broj bez prve znamenke.
  const vTax = str(v('vendorTaxId')), vVat = str(v('vendorVatId'))
  if (vTax && vVat && vTax.slice(1) !== vVat) {
    issues.push({ key: 'vat-tax', severity: 'warn', fields: ['vendorTaxId', 'vendorVatId'], message: 'PDV broj ne odgovara ID broju dobavljača.' })
  }

  // 7. Mogući duplikati: ne blokiraju, ali traže svjesnu potvrdu.
  const myVendor = vendorKey(inv, edits)
  const myNumber = norm(str(v('invoiceNumber')))
  for (const o of all) {
    if (o.id === inv.id || vendorKey(o, allEdits[o.id]) !== myVendor || !myVendor) continue
    const oNumber = norm(str(valueOf(o, allEdits[o.id], 'invoiceNumber')))
    const oTotal = num(valueOf(o, allEdits[o.id], 'totalAmount'))
    if (myNumber && myNumber === oNumber) {
      issues.push({ key: `dup:${o.id}`, severity: 'error', fields: [], message: `Mogući duplikat: isti dobavljač i broj računa kao ${o.id}.` })
    } else if (tot !== null && oTotal !== null && Math.abs(tot - oTotal) < 0.005) {
      issues.push({
        key: `dup:${o.id}`,
        severity: 'warn',
        fields: [],
        message: `Isti dobavljač i iznos kao ${o.id}, ali drugi broj računa. Ponavljajuća isporuka ili duplikat?`,
      })
    }
  }

  return issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1))
}

export function computeIssues(invoices: Invoice[], edits: Record<string, Edits>): Record<string, Issue[]> {
  return Object.fromEntries(invoices.map((i) => [i.id, checkInvoice(i, invoices, edits)]))
}
