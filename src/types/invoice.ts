export type Extracted<T> = {
  value: T | null
  confidence: number // 0..1; 0 with value=null means "field not on the invoice", not "unsure"
}

export type InvoiceFields = {
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

export type LineItem = {
  description: Extracted<string>
  quantity: Extracted<number>
  unit: Extracted<string>
  unitPrice: Extracted<number>
  vatRate: Extracted<number>
  lineTotal: Extracted<number>
}

export type Invoice = {
  id: string
  client: { id: string; name: string; taxId: string }
  receivedAt: string
  channel: 'mobile' | 'email'
  originalFilename: string
  // Five invoices have no original (arrived by email), so the UI must work without an image.
  original?: { path: string; mimeType: string; pages: number; width?: number; height?: number }
  fields: InvoiceFields
  lineItems: LineItem[]
}
