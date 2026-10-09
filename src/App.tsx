import { useEffect, useMemo, useState, type FC } from 'react'
import { Alert, AppShell, Box, Flex, Loader, Text } from '@mantine/core'
import { useHotkeys } from '@mantine/hooks'
import type { Invoice } from './types/invoice'
import { computeIssues, valueOf } from './lib/checks'
import { confirmedCsv, isExportable } from './lib/export'
import { useReview, type RejectReason } from './hooks/useReview'
import { InvoiceList } from './components/InvoiceList'
import { OriginalViewer } from './components/OriginalViewer'
import { FieldsPanel } from './components/FieldsPanel'

const App: FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  // 'loading' until invoices.json arrives; an error message if it can't be read.
  const [load, setLoad] = useState<'loading' | 'ok' | string>('loading')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [clientFilter, setClientFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const review = useReview()

  const edits = useMemo(
    () => Object.fromEntries(Object.entries(review.state).map(([id, entry]) => [id, entry.edits])),
    [review.state],
  )
  const rejected = useMemo(
    () =>
      new Set(
        Object.entries(review.state)
          .filter(([, entry]) => entry.status === 'rejected')
          .map(([id]) => id),
      ),
    [review.state],
  )
  const issues = useMemo(
    () => computeIssues(invoices, edits, rejected),
    [invoices, edits, rejected],
  )

  const clients = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; pending: number }>()
    invoices.forEach((invoice) => {
      const client = byId.get(invoice.client.id) ?? {
        id: invoice.client.id,
        name: invoice.client.name,
        pending: 0,
      }
      if ((review.state[invoice.id]?.status ?? 'pending') === 'pending') client.pending++
      byId.set(invoice.client.id, client)
    })
    return [...byId.values()].sort((first, second) => first.name.localeCompare(second.name, 'hr'))
  }, [invoices, review.state])

  // Search by vendor, invoice number or amount ("495", "495,57"), using corrected values.
  // With hundreds of invoices a month this is how a specific one is found, e.g. when a client
  // calls.
  const query = search.trim().toLowerCase().replace(',', '.')
  const matchesSearch = (invoice: Invoice) => {
    if (!query) return true
    const edits = review.get(invoice.id).edits
    const total = valueOf(invoice, edits, 'totalAmount')
    const searchable = [
      valueOf(invoice, edits, 'vendorName'),
      valueOf(invoice, edits, 'invoiceNumber'),
      typeof total === 'number' ? total.toFixed(2) : '',
    ]
    return searchable.some((value) =>
      String(value ?? '')
        .toLowerCase()
        .includes(query),
    )
  }

  const visible = invoices.filter(
    (invoice) =>
      (clientFilter === 'all' || invoice.client.id === clientFilter) &&
      (statusFilter === 'all' || review.get(invoice.id).status === statusFilter) &&
      matchesSearch(invoice),
  )

  const selected = invoices.find((invoice) => invoice.id === selectedId)
  const selectedIssues = selected ? (issues[selected.id] ?? []) : []
  const selectedEntry = selected ? review.get(selected.id) : null
  const canConfirm =
    !!selected &&
    selectedEntry!.status === 'pending' &&
    selectedIssues.every((issue) => selectedEntry!.resolved.includes(issue.key))

  const move = (delta: number) => {
    const index = visible.findIndex((invoice) => invoice.id === selectedId)
    const next = visible[index + delta]
    if (next) setSelectedId(next.id)
  }

  // Next unprocessed invoice in the list; if there is none after the current one, wrap to the top.
  const goToNextPending = (fromId: string) => {
    const index = visible.findIndex((invoice) => invoice.id === fromId)
    const isPending = (invoice: Invoice) =>
      invoice.id !== fromId && review.get(invoice.id).status === 'pending'
    const next = visible.slice(index + 1).find(isPending) ?? visible.find(isPending)
    if (next) setSelectedId(next.id)
  }

  // "Izvezi potvrđene": what would go to the booking system, as a CSV file to download.
  const exportConfirmed = () => {
    const blob = new Blob([confirmedCsv(invoices, review.state)], {
      type: 'text/csv;charset=utf-8',
    })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `potvrdeni-racuni-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const confirmAndNext = () => {
    if (!selected || !canConfirm) return
    review.confirm(selected.id)
    goToNextPending(selected.id)
  }

  const rejectAndNext = (reason: RejectReason) => {
    if (!selected) return
    review.reject(selected.id, reason)
    goToNextPending(selected.id)
  }

  // Load the invoices once, when the app opens.
  useEffect(() => {
    fetch('/invoices.json')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      })
      .then((data: { invoices: Invoice[] }) => {
        setInvoices(data.invoices)
        setSelectedId(data.invoices[0]?.id ?? null)
        setLoad('ok')
      })
      .catch((error: Error) => setLoad(error.message))
  }, [])

  // j/k navigation is ignored while typing in a field; Ctrl+Enter works from inside a field too.
  useHotkeys([
    ['j', () => move(1)],
    ['k', () => move(-1)],
  ])
  useHotkeys([['mod+Enter', confirmAndNext, { preventDefault: true }]], [])

  if (load === 'loading') return <Loader m="xl" />
  if (load !== 'ok' || invoices.length === 0) {
    return (
      <Alert color="red" title="Računi se nisu mogli učitati" m="xl">
        {load !== 'ok' ? `Greška: ${load}. ` : 'Datoteka s računima je prazna. '}
        Provjeri postoji li public/invoices.json i osvježi stranicu.
      </Alert>
    )
  }

  return (
    <AppShell navbar={{ width: 320, breakpoint: 'sm' }} padding={0}>
      <AppShell.Navbar>
        <InvoiceList
          invoices={visible}
          issues={issues}
          review={review.get}
          selectedId={selectedId}
          onSelect={setSelectedId}
          clients={clients}
          clientFilter={clientFilter}
          onClientFilter={(clientId) => {
            setClientFilter(clientId)
            // Don't keep another client's invoice open on the right while the list shows a
            // different company. Open the client's first invoice that the other filters show.
            if (clientId !== 'all' && selected?.client.id !== clientId) {
              const first = invoices.find(
                (invoice) =>
                  invoice.client.id === clientId &&
                  (statusFilter === 'all' || review.get(invoice.id).status === statusFilter) &&
                  matchesSearch(invoice),
              )
              setSelectedId(first?.id ?? null)
            }
          }}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
          search={search}
          onSearch={setSearch}
          total={invoices.length}
          doneCount={
            invoices.filter((invoice) => review.get(invoice.id).status !== 'pending').length
          }
          exportableCount={
            invoices.filter((invoice) => isExportable(review.state[invoice.id], issues[invoice.id]))
              .length
          }
          onExport={exportConfirmed}
        />
      </AppShell.Navbar>
      <AppShell.Main h="100vh">
        {selected && selectedEntry ? (
          <Flex h="100%">
            <Box style={{ flex: '1 1 55%', minWidth: 0 }}>
              <OriginalViewer key={selected.id} invoice={selected} />
            </Box>
            <Box
              w={440}
              style={{
                borderLeft: '1px solid var(--mantine-color-gray-3)',
                flexShrink: 0,
              }}
            >
              <FieldsPanel
                key={selected.id}
                invoice={selected}
                issues={selectedIssues}
                entry={selectedEntry}
                onEdit={(key, value) => review.setEdit(selected.id, key, value)}
                onClearEdit={(key) => {
                  // Which issues will this field have once the edit is gone? Those become open
                  // again.
                  const { [key]: _removed, ...withoutEdit } = selectedEntry.edits
                  const after = computeIssues(
                    invoices,
                    { ...edits, [selected.id]: withoutEdit },
                    rejected,
                  )
                  const reopen = after[selected.id].filter((issue) =>
                    (issue.fields as string[]).includes(key),
                  )
                  review.clearEdit(
                    selected.id,
                    key,
                    reopen.map((issue) => issue.key),
                  )
                }}
                onResolve={(keys) => review.resolve(selected.id, keys)}
                onConfirm={confirmAndNext}
                onReopen={() => {
                  review.reopen(selected.id)
                  // Reopened from "Potvrđeni" or "Odbačeni": follow the invoice to where it now
                  // belongs, so it doesn't stay open on the right while missing from the list.
                  if (statusFilter !== 'all') setStatusFilter('pending')
                }}
                onReject={rejectAndNext}
                onResetInvoice={() => review.resetOne(selected.id)}
                onOpenInvoice={(id) => {
                  // If the filters or the search hide that invoice, clear them so it also shows
                  // up in the list.
                  if (!visible.some((invoice) => invoice.id === id)) {
                    setClientFilter('all')
                    setStatusFilter('all')
                    setSearch('')
                  }
                  setSelectedId(id)
                }}
              />
            </Box>
          </Flex>
        ) : (
          <Text p="xl" c="dimmed">
            Odaberi račun s popisa.
          </Text>
        )}
      </AppShell.Main>
    </AppShell>
  )
}

export default App
