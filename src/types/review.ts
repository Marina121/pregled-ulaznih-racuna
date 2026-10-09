import type { InvoiceFields } from './invoice'

export type FieldKey = keyof InvoiceFields

export type FieldValue = InvoiceFields[FieldKey]['value']

export type Edits = { [K in FieldKey]?: InvoiceFields[K]['value'] }

export type ReviewEntry = {
  status: 'pending' | 'confirmed' | 'rejected'
  duplicateOf?: string
  // Rejected because the buyer is another company: it belongs in another client's folder.
  otherClient?: boolean
  decidedAt?: string
  edits: Edits
  resolved: string[]
}

export type ReviewState = Record<string, ReviewEntry>

export type RejectReason = { duplicateOf: string } | { otherClient: true }
