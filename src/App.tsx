import { useEffect, useMemo, useState } from 'react'
import { AppShell, Box, Flex, Loader, Text } from '@mantine/core'
import { useHotkeys } from '@mantine/hooks'
import type { Invoice } from './types/invoice'
import { computeIssues } from './lib/checks'
import { useReview } from './lib/review'
import { InvoiceList } from './components/InvoiceList'
import { OriginalViewer } from './components/OriginalViewer'
import { FieldsPanel } from './components/FieldsPanel'

export default function App() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [clientFilter, setClientFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const review = useReview()

  useEffect(() => {
    fetch('/invoices.json')
      .then((r) => r.json())
      .then((d: { invoices: Invoice[] }) => {
        setInvoices(d.invoices)
        setSelectedId(d.invoices[0]?.id ?? null)
      })
  }, [])

  const edits = useMemo(
    () => Object.fromEntries(Object.entries(review.state).map(([id, s]) => [id, s.edits])),
    [review.state],
  )
  const rejected = useMemo(
    () => new Set(Object.entries(review.state).filter(([, s]) => s.status === 'rejected').map(([id]) => id)),
    [review.state],
  )
  const issues = useMemo(() => computeIssues(invoices, edits, rejected), [invoices, edits, rejected])

  const clients = useMemo(() => {
    const m = new Map<string, { id: string; name: string; pending: number }>()
    invoices.forEach((i) => {
      const c = m.get(i.client.id) ?? { id: i.client.id, name: i.client.name, pending: 0 }
      if ((review.state[i.id]?.status ?? 'pending') === 'pending') c.pending++
      m.set(i.client.id, c)
    })
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'hr'))
  }, [invoices, review.state])

  const visible = invoices.filter(
    (i) =>
      (clientFilter === 'all' || i.client.id === clientFilter) &&
      (statusFilter === 'all' || review.get(i.id).status === statusFilter),
  )

  const selected = invoices.find((i) => i.id === selectedId)
  const selectedIssues = selected ? issues[selected.id] ?? [] : []
  const selectedEntry = selected ? review.get(selected.id) : null
  const canConfirm =
    !!selected && selectedEntry!.status === 'pending' && selectedIssues.every((i) => selectedEntry!.resolved.includes(i.key))

  const move = (delta: number) => {
    const idx = visible.findIndex((i) => i.id === selectedId)
    const next = visible[idx + delta]
    if (next) setSelectedId(next.id)
  }

  // Next unprocessed invoice in the list; if there is none after the current one, wrap to the top.
  const goToNextPending = (fromId: string) => {
    const idx = visible.findIndex((i) => i.id === fromId)
    const pending = (i: Invoice) => i.id !== fromId && review.get(i.id).status === 'pending'
    const next = visible.slice(idx + 1).find(pending) ?? visible.find(pending)
    if (next) setSelectedId(next.id)
  }

  const confirmAndNext = () => {
    if (!selected || !canConfirm) return
    review.confirm(selected.id)
    goToNextPending(selected.id)
  }

  const rejectAndNext = (duplicateOf: string) => {
    if (!selected) return
    review.reject(selected.id, duplicateOf)
    goToNextPending(selected.id)
  }

  // j/k navigation is ignored while typing in a field; Ctrl+Enter works from inside a field too.
  useHotkeys([
    ['j', () => move(1)],
    ['k', () => move(-1)],
  ])
  useHotkeys([['mod+Enter', confirmAndNext, { preventDefault: true }]], [])

  if (invoices.length === 0) return <Loader m="xl" />

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
          onClientFilter={(c) => {
            setClientFilter(c)
            // Don't keep another client's invoice open on the right while the list shows a different company.
            if (c !== 'all' && selected?.client.id !== c) {
              setSelectedId(invoices.find((i) => i.client.id === c)?.id ?? null)
            }
          }}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
          onReset={review.resetAll}
          total={invoices.length}
          doneCount={invoices.filter((i) => review.get(i.id).status !== 'pending').length}
        />
      </AppShell.Navbar>
      <AppShell.Main h="100vh">
        {selected && selectedEntry ? (
          <Flex h="100%">
            <Box style={{ flex: '1 1 55%', minWidth: 0 }}>
              <OriginalViewer key={selected.id} invoice={selected} />
            </Box>
            <Box w={440} style={{ borderLeft: '1px solid var(--mantine-color-gray-3)', flexShrink: 0 }}>
              <FieldsPanel
                key={selected.id}
                invoice={selected}
                issues={selectedIssues}
                entry={selectedEntry}
                onEdit={(k, v, rk) => review.setEdit(selected.id, k, v, rk)}
                onClearEdit={(k) => {
                  // Which issues will this field have once the edit is gone? Those become open again.
                  const { [k]: _removed, ...withoutEdit } = selectedEntry.edits
                  const after = computeIssues(invoices, { ...edits, [selected.id]: withoutEdit }, rejected)
                  const reopen = after[selected.id].filter((i) => (i.fields as string[]).includes(k))
                  review.clearEdit(selected.id, k, reopen.map((i) => i.key))
                }}
                onResolve={(keys) => review.resolve(selected.id, keys)}
                onConfirm={confirmAndNext}
                onReopen={() => review.reopen(selected.id)}
                onReject={rejectAndNext}
                onOpenInvoice={(id) => {
                  // If the filters hide that invoice, clear them so it also shows up in the list.
                  if (!visible.some((i) => i.id === id)) {
                    setClientFilter('all')
                    setStatusFilter('all')
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
