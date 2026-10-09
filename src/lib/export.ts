import type { Invoice } from '../types/invoice'
import { valueOf, type Edits } from './checks'
import { FIELD_META, type FieldKey } from './fields'
import type { ReviewState } from '../hooks/useReview'
import { isEmpty } from '../utils/values'

/** A field value as the accountant reads it: lists joined, nothing shown as "prazno". */
export const showValue = (value: unknown) =>
  isEmpty(value) ? 'prazno' : Array.isArray(value) ? value.join(', ') : String(value)

/**
 * What the accountant changed on an invoice: field, value as read, value now. An edit that ends
 * up equal to what was read (typed, then changed back) isn't a change.
 */
export function changesOf(invoice: Invoice, edits: Edits) {
  return FIELD_META.filter(
    (field) =>
      edits[field.key] !== undefined &&
      showValue(edits[field.key]) !== showValue(invoice.fields[field.key].value),
  ).map((field) => ({
    label: field.label,
    from: showValue(invoice.fields[field.key].value),
    to: showValue(edits[field.key]),
  }))
}

// Byte order mark: tells Excel the file is UTF-8. Written as an escape so it's visible here.
const BOM = '\uFEFF'

// What goes to the booking system, in this order.
const COLUMNS: FieldKey[] = [
  'vendorName',
  'vendorTaxId',
  'vendorVatId',
  'invoiceNumber',
  'issueDate',
  'supplyDate',
  'dueDate',
  'currency',
  'netAmount',
  'vatAmount',
  'totalAmount',
  'paymentReference',
  'bankAccounts',
]

// One CSV cell. Amounts always with two decimals. A value containing the separator, a quote or a
// line break is quoted, with quotes doubled, so it can't shift the columns.
const cell = (value: unknown) => {
  const text = isEmpty(value)
    ? ''
    : Array.isArray(value)
      ? value.join(', ')
      : typeof value === 'number'
        ? value.toFixed(2)
        : String(value)
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * Confirmed invoices as CSV, with the accountant's corrections, when each was confirmed and what
 * was changed. Separated by ";" and starting with a UTF-8 BOM, so Excel set to Croatian/Bosnian
 * opens it in columns and shows č, ć, đ, š, ž correctly.
 */
export function confirmedCsv(invoices: Invoice[], state: ReviewState): string {
  const label = (key: FieldKey) => FIELD_META.find((field) => field.key === key)?.label ?? key
  const header = ['Račun', 'Klijent', ...COLUMNS.map(label), 'Potvrđeno', 'Ispravljeno']
  const rows = invoices
    .filter((invoice) => state[invoice.id]?.status === 'confirmed')
    .map((invoice) => {
      const entry = state[invoice.id]
      const changes = changesOf(invoice, entry.edits).map(
        (change) => `${change.label} (${change.from} → ${change.to})`,
      )
      return [
        invoice.id,
        invoice.client.name,
        ...COLUMNS.map((key) => valueOf(invoice, entry.edits, key)),
        entry.decidedAt ?? '',
        changes.join(', '),
      ]
    })
  return BOM + [header, ...rows].map((row) => row.map(cell).join(';')).join('\r\n')
}
