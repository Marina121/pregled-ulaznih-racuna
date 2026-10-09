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
  const issues = useMemo(() => computeIssues(invoices, edits), [invoices, edits])

  const clients = useMemo(() => {
    const m = new Map<string, string>()
    invoices.forEach((i) => m.set(i.client.id, i.client.name))
    return [...m].map(([id, name]) => ({ id, name }))
  }, [invoices])

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

  const confirmAndNext = () => {
    if (!selected || !canConfirm) return
    review.confirm(selected.id)
    // Sljedeći nepotvrđeni račun u redu, a ako ga nema nakon trenutnog, prvi od početka.
    const idx = visible.findIndex((i) => i.id === selected.id)
    const pending = (i: Invoice) => i.id !== selected.id && review.get(i.id).status !== 'confirmed'
    const next = visible.slice(idx + 1).find(pending) ?? visible.find(pending)
    if (next) setSelectedId(next.id)
  }

  // j/k za kretanje se ne aktiviraju dok se piše u polju; Ctrl+Enter radi i iz polja.
  useHotkeys([
    ['j', () => move(1)],
    ['k', () => move(-1)],
  ])
  useHotkeys([['mod+Enter', confirmAndNext, { preventDefault: true }]], [])

  if (invoices.length === 0) return <Loader m="xl" />

  return (
    <AppShell navbar={{ width: 300, breakpoint: 'sm' }} padding={0}>
      <AppShell.Navbar>
        <InvoiceList
          invoices={visible}
          issues={issues}
          review={review.get}
          selectedId={selectedId}
          onSelect={setSelectedId}
          clients={clients}
          clientFilter={clientFilter}
          onClientFilter={setClientFilter}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
          total={invoices.length}
          confirmedCount={invoices.filter((i) => review.get(i.id).status === 'confirmed').length}
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
                onClearEdit={(k) => review.clearEdit(selected.id, k)}
                onResolve={(keys) => review.resolve(selected.id, keys)}
                onConfirm={confirmAndNext}
                onReopen={() => review.reopen(selected.id)}
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
