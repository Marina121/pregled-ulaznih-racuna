export interface Extracted<T> {
  value: T | null
  confidence: number // 0..1; 0 uz value=null znači "polja nema", ne "nesigurno"
}

export interface InvoiceFields {
  vendorName: Extracted<string>
  vendorTaxId: Extracted<string>
  vendorVatId: Extracted<string>
  buyerName: Extracted<string>
  buyerTaxId: Extracted<string>
  invoiceNumber: Extracted<string>
  issueDate: Extracted<string>
  supplyDate: Extracted<string>
  dueDate: Extracted<string>
  currency: Extracted<string>
  netAmount: Extracted<number>
  vatAmount: Extracted<number>
  totalAmount: Extracted<number>
  paymentReference: Extracted<string>
  bankAccounts: Extracted<string[]>
}

export interface LineItem {
  description: Extracted<string>
  quantity: Extracted<number>
  unit: Extracted<string>
  unitPrice: Extracted<number>
  vatRate: Extracted<number>
  lineTotal: Extracted<number>
}

export interface Invoice {
  id: string
  client: { id: string; name: string; taxId: string }
  receivedAt: string
  channel: 'mobile' | 'email' | string
  originalFilename: string
  // Pet računa nema original (stigli e-poštom), UI mora raditi i bez slike.
  original?: { path: string; mimeType: string; pages: number; width?: number; height?: number }
  fields: InvoiceFields
  lineItems: LineItem[]
}
