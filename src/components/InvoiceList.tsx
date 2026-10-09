import { useState, type FC } from 'react'
import {
  Badge,
  Box,
  Button,
  CloseButton,
  Group,
  Kbd,
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
import type { FieldKey, ReviewEntry } from '../types/review'
import { openIssues, valueOf, type Issue } from '../lib/checks'
import type { ClientSummary, Filters, StatusFilter } from '../lib/filters'
import { useConfirmHotkeyLabel } from '../hooks/useConfirmHotkeyLabel'

export type Props = {
  invoices: Invoice[]
  issues: Record<string, Issue[]>
  review: (id: string) => ReviewEntry
  selectedId: string | null
  onSelect: (id: string) => void
  clients: ClientSummary[]
  filters: Filters
  onFiltersChange: (change: Partial<Filters>) => void
  progress: { total: number; done: number; exportable: number }
  onExport: () => void
}

const STATUS_OPTIONS: { label: string; value: StatusFilter }[] = [
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
  filters,
  onFiltersChange,
  progress,
  onExport,
}) => {
  const [clientSearch, setClientSearch] = useState<string | null>(null)
  const confirmHotkey = useConfirmHotkeyLabel()
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
  const selectedLabel = clientOptions.find((option) => option.value === filters.client)?.label ?? ''

  return (
    <Stack gap={0} h="100%">
      <Stack gap="xs" p="sm" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
        <Group justify="space-between">
          <Text fw={600}>Ulazni računi</Text>
          <Text size="xs" c="dimmed">
            {progress.done} od {progress.total} obrađeno
          </Text>
        </Group>
        <Progress
          value={(progress.done / Math.max(progress.total, 1)) * 100}
          size="sm"
          aria-label="Napredak pregleda"
        />
        <TextInput
          size="xs"
          placeholder="Traži dobavljača, broj ili iznos"
          value={filters.search}
          onChange={(event) => onFiltersChange({ search: event.currentTarget.value })}
          aria-label="Pretraga računa"
          rightSection={
            filters.search ? (
              <CloseButton
                size="xs"
                onClick={() => onFiltersChange({ search: '' })}
                aria-label="Očisti pretragu"
              />
            ) : null
          }
        />
        <Select
          size="xs"
          searchable
          allowDeselect={false}
          selectFirstOptionOnChange
          nothingFoundMessage="Nema takvog klijenta"
          value={filters.client}
          onChange={(clientId) => clientId && onFiltersChange({ client: clientId })}
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
          value={filters.status}
          onChange={(status) => onFiltersChange({ status: status as StatusFilter })}
          data={STATUS_OPTIONS}
        />
      </Stack>
      <ScrollArea style={{ flex: 1 }} bg="var(--mantine-color-gray-0)">
        {invoices.map((invoice) => {
          const entry = review(invoice.id)
          const open = openIssues(issues[invoice.id] ?? [], entry.resolved)
          const hasError = open.some((issue) => issue.severity === 'error')
          const rejected = entry.status === 'rejected'
          // Confirmed, but a new issue appeared afterwards: shown as needing review again.
          const confirmed = entry.status === 'confirmed' && open.length === 0
          const recheck = entry.status === 'confirmed' && open.length > 0
          const valueFor = <K extends FieldKey>(key: K) => valueOf(invoice, entry.edits, key)
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
                  {valueFor('vendorName') ?? ''}
                </Text>
                {rejected ? (
                  <Badge color="gray" variant="light" size="sm" style={{ flexShrink: 0 }}>
                    {entry.otherClient ? 'drugi kupac' : 'duplikat'}
                  </Badge>
                ) : recheck ? (
                  <Badge color="red" variant="filled" size="sm" style={{ flexShrink: 0 }}>
                    provjeri ponovno
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
                  {valueFor('invoiceNumber') ?? 'bez broja'}
                  {filters.client === 'all' ? ` · ${invoice.client.id}` : ''}
                </Text>
                <Text size="sm" fw={600} style={{ flexShrink: 0 }}>
                  {typeof amount === 'number' ? amount.toFixed(2) : '—'}{' '}
                  <Text span size="xs" c="dimmed" fw={400}>
                    {valueFor('currency') ?? ''}
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
          disabled={progress.exportable === 0}
          onClick={onExport}
        >
          Izvezi potvrđene ({progress.exportable}) u CSV
        </Button>
        <Text size="xs" c="dimmed" ta="center" mt={6}>
          <Kbd size="xs">j</Kbd> / <Kbd size="xs">k</Kbd> sljedeći / prethodni ·{' '}
          <Kbd size="xs">{confirmHotkey}</Kbd> potvrdi
        </Text>
      </Box>
    </Stack>
  )
}
