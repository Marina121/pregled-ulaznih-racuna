import { useMemo, useState, type FC } from 'react'
import { Alert, AppShell, Box, Flex, Loader, Text } from '@mantine/core'
import { useHotkeys } from '@mantine/hooks'
import type { Invoice } from './types/invoice'
import type { RejectReason } from './types/review'
import { canConfirm, issuesAfterClearing, issuesFor } from './lib/checks'
import { confirmedCsv, isExportable } from './lib/export'
import { clientsOf, matchesFilters, NO_FILTERS, type Filters } from './lib/filters'
import { downloadFile } from './utils/download'
import { useInvoices } from './hooks/useInvoices'
import { useReview } from './hooks/useReview'
import { InvoiceList } from './components/InvoiceList'
import { OriginalViewer } from './components/OriginalViewer'
import { FieldsPanel } from './components/FieldsPanel'

const NO_INVOICES: Invoice[] = []

const App: FC = () => {
  const load = useInvoices()
  // undefined until the accountant picks one; until then the first invoice is open.
  const [pickedId, setSelectedId] = useState<string | null>()
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const review = useReview()

  const invoices = load.status === 'ready' ? load.invoices : NO_INVOICES
  const selectedId = pickedId === undefined ? (invoices[0]?.id ?? null) : pickedId
  const issues = useMemo(() => issuesFor(invoices, review.state), [invoices, review.state])
  const clients = useMemo(() => clientsOf(invoices, review.state), [invoices, review.state])
  const visible = invoices.filter((invoice) =>
    matchesFilters(invoice, review.get(invoice.id), filters),
  )
  const selected = invoices.find((invoice) => invoice.id === selectedId)
  const selectedIssues = selected ? (issues[selected.id] ?? []) : []
  const selectedEntry = selected ? review.get(selected.id) : null
  const progress = {
    total: invoices.length,
    done: invoices.filter((invoice) => review.get(invoice.id).status !== 'pending').length,
    exportable: invoices.filter((invoice) =>
      isExportable(review.state[invoice.id], issues[invoice.id]),
    ).length,
  }

  const changeFilters = (change: Partial<Filters>) => {
    const next = { ...filters, ...change }
    setFilters(next)
    // Whatever filter changed, the invoice open on the right must be one the list shows.
    const shown = invoices.filter((invoice) =>
      matchesFilters(invoice, review.get(invoice.id), next),
    )
    if (!shown.some((invoice) => invoice.id === selectedId)) setSelectedId(shown[0]?.id ?? null)
  }

  const move = (delta: number) => {
    const index = visible.findIndex((invoice) => invoice.id === selectedId)
    const next = visible[index + delta]
    if (next) setSelectedId(next.id)
  }

  const goToNextPending = (fromId: string) => {
    const index = visible.findIndex((invoice) => invoice.id === fromId)
    const isPending = (invoice: Invoice) =>
      invoice.id !== fromId && review.get(invoice.id).status === 'pending'
    const next = visible.slice(index + 1).find(isPending) ?? visible.find(isPending)
    if (next) setSelectedId(next.id)
  }

  const exportConfirmed = () =>
    downloadFile(
      `potvrdeni-racuni-${new Date().toISOString().slice(0, 10)}.csv`,
      confirmedCsv(invoices, review.state),
      'text/csv;charset=utf-8',
    )

  const confirmAndNext = () => {
    if (!selected || !selectedEntry || !canConfirm(selectedEntry, selectedIssues)) return
    review.confirm(selected.id)
    goToNextPending(selected.id)
  }

  const rejectAndNext = (reason: RejectReason) => {
    if (!selected) return
    review.reject(selected.id, reason)
    goToNextPending(selected.id)
  }

  const reopen = (id: string) => {
    review.reopen(id)
    // Reopened from "Potvrđeni" or "Odbačeni": follow the invoice to where it now belongs, so it
    // doesn't stay open on the right while missing from the list.
    if (filters.status !== 'all') setFilters({ ...filters, status: 'pending' })
  }

  const openInvoice = (id: string) => {
    // If the filters or the search hide that invoice, clear them so it also shows up in the list.
    if (!visible.some((invoice) => invoice.id === id)) setFilters(NO_FILTERS)
    setSelectedId(id)
  }

  // j/k navigation is ignored while typing in a field. The empty list is the tags to ignore, not
  // dependencies: mod+Enter works from inside a field too.
  useHotkeys([
    ['j', () => move(1)],
    ['k', () => move(-1)],
  ])
  useHotkeys([['mod+Enter', confirmAndNext, { preventDefault: true }]], [])

  if (load.status === 'loading') return <Loader m="xl" />
  if (load.status === 'error' || invoices.length === 0) {
    return (
      <Alert color="red" title="Računi se nisu mogli učitati" m="xl">
        {load.status === 'error' ? `Greška: ${load.message}. ` : 'Datoteka s računima je prazna. '}
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
          filters={filters}
          onFiltersChange={changeFilters}
          progress={progress}
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
                onClearEdit={(key) =>
                  review.clearEdit(
                    selected.id,
                    key,
                    issuesAfterClearing(invoices, review.state, selected.id, key),
                  )
                }
                onResolve={(keys) => review.resolve(selected.id, keys)}
                onConfirm={confirmAndNext}
                onReopen={() => reopen(selected.id)}
                onReject={rejectAndNext}
                onResetInvoice={() => review.resetOne(selected.id)}
                onRestoreInvoice={(entry) => review.restore(selected.id, entry)}
                onOpenInvoice={openInvoice}
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
