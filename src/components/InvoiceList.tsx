import { useState } from 'react'
import {
  Badge,
  Box,
  Button,
  CloseButton,
  Group,
  Progress,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core'
import type { Invoice } from '../types/invoice'
import { valueOf, type Issue } from '../lib/checks'
import type { FieldKey } from '../lib/fields'
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
  search: string
  onSearch: (v: string) => void
  total: number
  doneCount: number
  confirmedCount: number
  onExport: () => void
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
        <Progress
          value={(p.doneCount / Math.max(p.total, 1)) * 100}
          size="sm"
          aria-label="Napredak pregleda"
        />
        <TextInput
          size="xs"
          placeholder="Traži dobavljača, broj ili iznos"
          value={p.search}
          onChange={(e) => p.onSearch(e.currentTarget.value)}
          aria-label="Pretraga računa"
          rightSection={
            p.search ? (
              <CloseButton size="xs" onClick={() => p.onSearch('')} aria-label="Očisti pretragu" />
            ) : null
          }
        />
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
      <ScrollArea style={{ flex: 1 }} bg="var(--mantine-color-gray-0)">
        {p.invoices.map((inv) => {
          const e = p.review(inv.id)
          const open = (p.issues[inv.id] ?? []).filter((i) => !e.resolved.includes(i.key))
          const hasError = open.some((i) => i.severity === 'error')
          const confirmed = e.status === 'confirmed'
          const rejected = e.status === 'rejected'
          // Show the accountant's corrections, not what the reader originally returned.
          const val = (k: FieldKey) => valueOf(inv, e.edits, k)
          const total = val('totalAmount')
          // One colour per state, used for the stripe on the left edge so the list can be
          // scanned without reading the badges.
          const color = rejected
            ? 'gray'
            : confirmed
              ? 'green'
              : open.length > 0
                ? hasError
                  ? 'red'
                  : 'yellow'
                : 'teal'
          const selected = inv.id === p.selectedId
          return (
            <UnstyledButton
              key={inv.id}
              onClick={() => p.onSelect(inv.id)}
              py="sm"
              pr="sm"
              pl={selected ? 'calc(var(--mantine-spacing-sm) - 2px)' : 'sm'}
              w="100%"
              style={{
                borderBottom: '1px solid var(--mantine-color-gray-2)',
                borderLeft: `${selected ? 6 : 4}px solid var(--mantine-color-${selected ? 'teal-7' : `${color}-4`})`,
                opacity: confirmed || rejected ? 0.6 : 1,
              }}
              bg={selected ? 'var(--mantine-primary-color-light)' : 'var(--mantine-color-white)'}
            >
              <Group justify="space-between" wrap="nowrap" gap="xs">
                <Text size="sm" fw={500} truncate>
                  {String(val('vendorName') ?? '')}
                </Text>
                {rejected ? (
                  <Badge color="gray" variant="light" size="sm" style={{ flexShrink: 0 }}>
                    duplikat
                  </Badge>
                ) : confirmed ? (
                  <Badge color="green" variant="light" size="sm" style={{ flexShrink: 0 }}>
                    ✓
                  </Badge>
                ) : open.length > 0 ? (
                  <Badge
                    color={hasError ? 'red' : 'yellow'}
                    variant="light"
                    size="sm"
                    style={{ flexShrink: 0 }}
                  >
                    {open.length}
                  </Badge>
                ) : (
                  <Badge color="teal" variant="light" size="sm" style={{ flexShrink: 0 }}>
                    spreman
                  </Badge>
                )}
              </Group>
              {/* The amount is what the accountant looks for, so it's bold and on the right. */}
              <Group justify="space-between" mt={4} wrap="nowrap" gap="xs">
                <Text size="xs" c="dimmed" truncate>
                  {String(val('invoiceNumber') ?? 'bez broja')}
                  {p.clientFilter === 'all' ? ` · ${inv.client.id}` : ''}
                </Text>
                <Text size="sm" fw={600} style={{ flexShrink: 0 }}>
                  {typeof total === 'number' ? total.toFixed(2) : '—'}{' '}
                  <Text span size="xs" c="dimmed" fw={400}>
                    {String(val('currency') ?? '')}
                  </Text>
                </Text>
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
      {/* After the review: the confirmed invoices, with corrections, as they'd go to booking. */}
      <Box p="xs" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
        <Button
          size="compact-sm"
          variant="light"
          fullWidth
          disabled={p.confirmedCount === 0}
          onClick={p.onExport}
        >
          Izvezi potvrđene ({p.confirmedCount}) u CSV
        </Button>
      </Box>
    </Stack>
  )
}
