import { useState } from 'react'
import { Badge, Box, Group, ScrollArea, SegmentedControl, Select, Stack, Text, UnstyledButton } from '@mantine/core'
import type { Invoice } from '../types/invoice'
import type { Issue } from '../lib/checks'
import type { ReviewEntry } from '../lib/review'

interface Props {
  invoices: Invoice[] // already filtered
  issues: Record<string, Issue[]>
  review: (id: string) => ReviewEntry
  selectedId: string | null
  onSelect: (id: string) => void
  clients: { id: string; name: string; pending: number }[]
  clientFilter: string
  onClientFilter: (v: string) => void
  statusFilter: string
  onStatusFilter: (v: string) => void
  total: number
  doneCount: number
}

export function InvoiceList(p: Props) {
  // null = dropdown closed, the input shows the selected client.
  const [search, setSearch] = useState<string | null>(null)
  const clientOptions = [
    { label: 'Svi klijenti', value: 'all' },
    ...p.clients.map((c) => ({
      label: c.pending > 0 ? `${c.name} · ${c.pending} za pregled` : `${c.name} · sve potvrđeno`,
      value: c.id,
    })),
  ]
  const selectedLabel = clientOptions.find((o) => o.value === p.clientFilter)?.label ?? ''

  return (
    <Stack gap={0} h="100%">
      <Stack gap="xs" p="sm" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
        <Group justify="space-between">
          <Text fw={600}>Ulazni računi</Text>
          <Text size="xs" c="dimmed">
            {p.doneCount} od {p.total} obrađeno
          </Text>
        </Group>
        {/* The accountant handles ~40 companies, so a searchable dropdown instead of buttons. */}
        <Select
          size="xs"
          searchable
          allowDeselect={false}
          selectFirstOptionOnChange
          nothingFoundMessage="Nema takvog klijenta"
          value={p.clientFilter}
          onChange={(v) => v && p.onClientFilter(v)}
          data={clientOptions}
          // Clear the input on open so typing starts fresh instead of after "Svi klijenti".
          searchValue={search ?? selectedLabel}
          onSearchChange={(s) => search !== null && setSearch(s)}
          onDropdownOpen={() => setSearch('')}
          onDropdownClose={() => setSearch(null)}
          aria-label="Klijent"
        />
        <SegmentedControl
          size="xs"
          fullWidth
          value={p.statusFilter}
          onChange={p.onStatusFilter}
          data={[
            { label: 'Sve', value: 'all' },
            { label: 'Za pregled', value: 'pending' },
            { label: 'Potvrđeni', value: 'confirmed' },
            { label: 'Odbačeni', value: 'rejected' },
          ]}
        />
      </Stack>
      <ScrollArea style={{ flex: 1 }}>
        {p.invoices.map((inv) => {
          const e = p.review(inv.id)
          const open = (p.issues[inv.id] ?? []).filter((i) => !e.resolved.includes(i.key))
          const hasError = open.some((i) => i.severity === 'error')
          const confirmed = e.status === 'confirmed'
          const rejected = e.status === 'rejected'
          return (
            <UnstyledButton
              key={inv.id}
              onClick={() => p.onSelect(inv.id)}
              p="sm"
              w="100%"
              style={{ borderBottom: '1px solid var(--mantine-color-gray-2)', opacity: confirmed || rejected ? 0.6 : 1 }}
              bg={inv.id === p.selectedId ? 'var(--mantine-color-blue-light)' : undefined}
            >
              <Group justify="space-between" wrap="nowrap" gap="xs">
                <Text size="sm" truncate>
                  {inv.fields.vendorName.value}
                </Text>
                {rejected ? (
                  <Badge color="gray" variant="light" size="sm">
                    duplikat
                  </Badge>
                ) : confirmed ? (
                  <Badge color="green" variant="light" size="sm">
                    ✓
                  </Badge>
                ) : open.length > 0 ? (
                  <Badge color={hasError ? 'red' : 'yellow'} variant="light" size="sm">
                    {open.length}
                  </Badge>
                ) : (
                  <Badge color="gray" variant="light" size="sm">
                    spreman
                  </Badge>
                )}
              </Group>
              <Group justify="space-between" mt={2}>
                <Text size="xs" c="dimmed">
                  {inv.fields.invoiceNumber.value ?? 'bez broja'} · {inv.fields.totalAmount.value?.toFixed(2)}{' '}
                  {inv.fields.currency.value ?? ''}
                </Text>
                {p.clientFilter === 'all' && (
                  <Text size="xs" c="dimmed">
                    {inv.client.id}
                  </Text>
                )}
              </Group>
            </UnstyledButton>
          )
        })}
        {p.invoices.length === 0 && (
          <Box p="md">
            <Text size="sm" c="dimmed">
              Nema računa za ovaj filter.
            </Text>
          </Box>
        )}
      </ScrollArea>
    </Stack>
  )
}
