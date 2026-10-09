import type { InvoiceFields } from '../types/invoice'

export type FieldKey = keyof InvoiceFields
export type FieldKind = 'text' | 'date' | 'number' | 'list'

export interface FieldMeta {
  key: FieldKey
  label: string
  kind: FieldKind
  // Obavezno polje: ako ga nema, računovođa to mora riješiti prije potvrde.
  // Neobavezna polja (npr. poziv na broj) koja nedostaju NISU upozorenje:
  // pouzdanost 0 uz null znači "na računu toga nema", ne "sustav je nesiguran".
  required: boolean
}

export const FIELD_META: FieldMeta[] = [
  { key: 'vendorName', label: 'Dobavljač', kind: 'text', required: true },
  { key: 'vendorTaxId', label: 'ID broj dobavljača', kind: 'text', required: false },
  { key: 'vendorVatId', label: 'PDV broj dobavljača', kind: 'text', required: false },
  { key: 'invoiceNumber', label: 'Broj računa', kind: 'text', required: true },
  { key: 'issueDate', label: 'Datum računa', kind: 'date', required: true },
  { key: 'supplyDate', label: 'Datum isporuke', kind: 'date', required: false },
  { key: 'dueDate', label: 'Datum dospijeća', kind: 'date', required: false },
  { key: 'currency', label: 'Valuta', kind: 'text', required: true },
  { key: 'netAmount', label: 'Osnovica (neto)', kind: 'number', required: true },
  { key: 'vatAmount', label: 'PDV', kind: 'number', required: true },
  { key: 'totalAmount', label: 'Ukupno', kind: 'number', required: true },
  { key: 'buyerName', label: 'Kupac', kind: 'text', required: true },
  { key: 'buyerTaxId', label: 'ID broj kupca', kind: 'text', required: true },
  { key: 'paymentReference', label: 'Poziv na broj', kind: 'text', required: false },
  { key: 'bankAccounts', label: 'Računi (IBAN)', kind: 'list', required: false },
]
