import { useState, type FC } from 'react'
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
import type { ReviewEntry } from '../hooks/useReview'

export type Props = {
  invoices: Invoice[]
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

const STATUS_OPTIONS = [
  { label: 'Sve', value: 'all' },
  { label: 'Za pregled', value: 'pending' },
  { label: 'Potvrđeni', value: 'confirmed' },
  { label: 'Odbačeni', value: 'rejected' },
]

export const InvoiceList: FC<Props> = ({
  invoices,
  issues,
  review,
  selectedId,
  onSelect,
  clients,
  clientFilter,
  onClientFilter,
  statusFilter,
  onStatusFilter,
  search,
  onSearch,
  total,
  doneCount,
  confirmedCount,
  onExport,
}) => {
  const [clientSearch, setClientSearch] = useState<string | null>(null)
  const clientOptions = [
    { label: 'Svi klijenti', value: 'all' },
    ...clients.map((client) => ({
      label:
        client.pending > 0
          ? `${client.name} · ${client.pending} za pregled`
          : `${client.name} · sve potvrđeno`,
      value: client.id,
    })),
  ]
  const selectedLabel = clientOptions.find((option) => option.value === clientFilter)?.label ?? ''

  return (
    <Stack gap={0} h="100%">
      <Stack gap="xs" p="sm" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
        <Group justify="space-between">
          <Text fw={600}>Ulazni računi</Text>
          <Text size="xs" c="dimmed">
            {doneCount} od {total} obrađeno
          </Text>
        </Group>
        <Progress
          value={(doneCount / Math.max(total, 1)) * 100}
          size="sm"
          aria-label="Napredak pregleda"
        />
        <TextInput
          size="xs"
          placeholder="Traži dobavljača, broj ili iznos"
          value={search}
          onChange={(event) => onSearch(event.currentTarget.value)}
          aria-label="Pretraga računa"
          rightSection={
            search ? (
              <CloseButton size="xs" onClick={() => onSearch('')} aria-label="Očisti pretragu" />
            ) : null
          }
        />
        <Select
          size="xs"
          searchable
          allowDeselect={false}
          selectFirstOptionOnChange
          nothingFoundMessage="Nema takvog klijenta"
          value={clientFilter}
          onChange={(clientId) => clientId && onClientFilter(clientId)}
          data={clientOptions}
          searchValue={clientSearch ?? selectedLabel}
          onSearchChange={(text) => clientSearch !== null && setClientSearch(text)}
          onDropdownOpen={() => setClientSearch('')}
          onDropdownClose={() => setClientSearch(null)}
          aria-label="Klijent"
        />
        <SegmentedControl
          size="xs"
          fullWidth
          value={statusFilter}
          onChange={onStatusFilter}
          data={STATUS_OPTIONS}
        />
      </Stack>
      <ScrollArea style={{ flex: 1 }} bg="var(--mantine-color-gray-0)">
        {invoices.map((invoice) => {
          const entry = review(invoice.id)
          const open = (issues[invoice.id] ?? []).filter(
            (issue) => !entry.resolved.includes(issue.key),
          )
          const hasError = open.some((issue) => issue.severity === 'error')
          const confirmed = entry.status === 'confirmed'
          const rejected = entry.status === 'rejected'
          const valueFor = (key: FieldKey) => valueOf(invoice, entry.edits, key)
          const amount = valueFor('totalAmount')

          const color = rejected
            ? 'gray'
            : confirmed
              ? 'green'
              : open.length > 0
                ? hasError
                  ? 'red'
                  : 'yellow'
                : 'teal'
          const selected = invoice.id === selectedId
          return (
            <UnstyledButton
              key={invoice.id}
              onClick={() => onSelect(invoice.id)}
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
                  {String(valueFor('vendorName') ?? '')}
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
              <Group justify="space-between" mt={4} wrap="nowrap" gap="xs">
                <Text size="xs" c="dimmed" truncate>
                  {String(valueFor('invoiceNumber') ?? 'bez broja')}
                  {clientFilter === 'all' ? ` · ${invoice.client.id}` : ''}
                </Text>
                <Text size="sm" fw={600} style={{ flexShrink: 0 }}>
                  {typeof amount === 'number' ? amount.toFixed(2) : '—'}{' '}
                  <Text span size="xs" c="dimmed" fw={400}>
                    {String(valueFor('currency') ?? '')}
                  </Text>
                </Text>
              </Group>
            </UnstyledButton>
          )
        })}
        {invoices.length === 0 && (
          <Box p="md">
            <Text size="sm" c="dimmed">
              Nema računa za ovaj filter.
            </Text>
          </Box>
        )}
      </ScrollArea>
      <Box p="xs" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
        <Button
          size="compact-sm"
          variant="light"
          fullWidth
          disabled={confirmedCount === 0}
          onClick={onExport}
        >
          Izvezi potvrđene ({confirmedCount}) u CSV
        </Button>
      </Box>
    </Stack>
  )
}
