import type { InvoiceFields } from '../types/invoice'

export type FieldKey = keyof InvoiceFields
export type FieldKind = 'text' | 'date' | 'number' | 'list' | 'select'

export interface FieldMeta {
  key: FieldKey
  label: string
  kind: FieldKind
  // Required field: if it's missing, the accountant must resolve it before confirming.
  // Missing optional fields (e.g. payment reference) are NOT a warning:
  // confidence 0 with null means "not on the invoice", not "the system is unsure".
  required: boolean
  /** For kind 'select': the only accepted values. Booking expects exact codes, so free text
   * like "bAM" or "KM" must not get through. */
  options?: { value: string; label: string }[]
}

// Currencies the booking system accepts. Invoices in BiH often print "KM" for BAM.
export const CURRENCIES = [
  { value: 'BAM', label: 'BAM (KM)' },
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
]

export const FIELD_META: FieldMeta[] = [
  { key: 'vendorName', label: 'Dobavljač', kind: 'text', required: true },
  { key: 'vendorTaxId', label: 'ID broj dobavljača', kind: 'text', required: false },
  { key: 'vendorVatId', label: 'PDV broj dobavljača', kind: 'text', required: false },
  { key: 'invoiceNumber', label: 'Broj računa', kind: 'text', required: true },
  { key: 'issueDate', label: 'Datum računa', kind: 'date', required: true },
  { key: 'supplyDate', label: 'Datum isporuke', kind: 'date', required: false },
  { key: 'dueDate', label: 'Datum dospijeća', kind: 'date', required: false },
  { key: 'currency', label: 'Valuta', kind: 'select', required: true, options: CURRENCIES },
  { key: 'netAmount', label: 'Osnovica (neto)', kind: 'number', required: true },
  { key: 'vatAmount', label: 'PDV', kind: 'number', required: true },
  { key: 'totalAmount', label: 'Ukupno', kind: 'number', required: true },
  { key: 'buyerName', label: 'Kupac', kind: 'text', required: true },
  { key: 'buyerTaxId', label: 'ID broj kupca', kind: 'text', required: true },
  { key: 'paymentReference', label: 'Poziv na broj', kind: 'text', required: false },
  { key: 'bankAccounts', label: 'Žiro-računi dobavljača', kind: 'list', required: false },
]
