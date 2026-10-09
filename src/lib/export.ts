import type { Invoice } from '../types/invoice'
import { valueOf, type Edits } from './checks'
import { FIELD_META, type FieldKey } from './fields'
import type { ReviewState } from './review'

const isBlank = (v: unknown) =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)

/** A field value as the accountant reads it: lists joined, nothing shown as "prazno". */
export const showValue = (v: unknown) =>
  isBlank(v) ? 'prazno' : Array.isArray(v) ? v.join(', ') : String(v)

/**
 * What the accountant changed on an invoice: field, value as read, value now. An edit that ends
 * up equal to what was read (typed, then changed back) isn't a change.
 */
export function changesOf(inv: Invoice, edits: Edits) {
  return FIELD_META.filter(
    (m) =>
      edits[m.key] !== undefined && showValue(edits[m.key]) !== showValue(inv.fields[m.key].value),
  ).map((m) => ({
    label: m.label,
    from: showValue(inv.fields[m.key].value),
    to: showValue(edits[m.key]),
  }))
}

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
const cell = (v: unknown) => {
  const s = isBlank(v)
    ? ''
    : Array.isArray(v)
      ? v.join(', ')
      : typeof v === 'number'
        ? v.toFixed(2)
        : String(v)
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Confirmed invoices as CSV, with the accountant's corrections, when each was confirmed and what
 * was changed. Separated by ";" and starting with a UTF-8 BOM, so Excel set to Croatian/Bosnian
 * opens it in columns and shows č, ć, đ, š, ž correctly.
 */
export function confirmedCsv(invoices: Invoice[], state: ReviewState): string {
  const label = (k: FieldKey) => FIELD_META.find((m) => m.key === k)?.label ?? k
  const header = ['Račun', 'Klijent', ...COLUMNS.map(label), 'Potvrđeno', 'Ispravljeno']
  const rows = invoices
    .filter((i) => state[i.id]?.status === 'confirmed')
    .map((i) => {
      const e = state[i.id]
      const changes = changesOf(i, e.edits).map((c) => `${c.label} (${c.from} → ${c.to})`)
      return [
        i.id,
        i.client.name,
        ...COLUMNS.map((k) => valueOf(i, e.edits, k)),
        e.decidedAt ?? '',
        changes.join(', '),
      ]
    })
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n')
}
