import type { Invoice } from '../types/invoice'
import type { ReviewEntry, ReviewState } from '../types/review'
import { valueOf } from './checks'

export type StatusFilter = 'all' | ReviewEntry['status']

export type Filters = { client: string; status: StatusFilter; search: string }

export const NO_FILTERS: Filters = { client: 'all', status: 'all', search: '' }

export type ClientSummary = { id: string; name: string; pending: number }

// Search by vendor, invoice number or amount ("495", "495,57"), using corrected values.
// With hundreds of invoices a month this is how a specific one is found, e.g. when a client
// calls.
function matchesSearch(invoice: Invoice, entry: ReviewEntry, search: string) {
  const query = search.trim().toLowerCase().replace(',', '.')
  if (!query) return true
  const total = valueOf(invoice, entry.edits, 'totalAmount')
  return [
    valueOf(invoice, entry.edits, 'vendorName') ?? '',
    valueOf(invoice, entry.edits, 'invoiceNumber') ?? '',
    total === null ? '' : total.toFixed(2),
  ].some((value) => value.toLowerCase().includes(query))
}

export const matchesFilters = (invoice: Invoice, entry: ReviewEntry, filters: Filters) =>
  (filters.client === 'all' || invoice.client.id === filters.client) &&
  (filters.status === 'all' || entry.status === filters.status) &&
  matchesSearch(invoice, entry, filters.search)

/** Clients for the client picker, by name, with how many of their invoices are still pending. */
export function clientsOf(invoices: Invoice[], state: ReviewState): ClientSummary[] {
  const byId = new Map<string, ClientSummary>()
  invoices.forEach((invoice) => {
    const client = byId.get(invoice.client.id) ?? {
      id: invoice.client.id,
      name: invoice.client.name,
      pending: 0,
    }
    if ((state[invoice.id]?.status ?? 'pending') === 'pending') client.pending++
    byId.set(invoice.client.id, client)
  })
  return [...byId.values()].sort((first, second) => first.name.localeCompare(second.name, 'hr'))
}
