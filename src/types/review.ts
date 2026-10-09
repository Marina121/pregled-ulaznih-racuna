import type { InvoiceFields } from './invoice'

export type FieldKey = keyof InvoiceFields

/** What a field can hold: text, a number, a list of bank accounts, or nothing. */
export type FieldValue = InvoiceFields[FieldKey]['value']

/** The accountant's corrections, each with the same type as the value that was read. */
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
