import { Badge, Box, Group, ScrollArea, SegmentedControl, Stack, Text, UnstyledButton } from '@mantine/core'
import type { Invoice } from '../types/invoice'
import type { Issue } from '../lib/checks'
import type { ReviewEntry } from '../lib/review'

interface Props {
  invoices: Invoice[] // već filtrirani
  issues: Record<string, Issue[]>
  review: (id: string) => ReviewEntry
  selectedId: string | null
  onSelect: (id: string) => void
  clients: { id: string; name: string }[]
  clientFilter: string
  onClientFilter: (v: string) => void
  statusFilter: string
  onStatusFilter: (v: string) => void
  total: number
  confirmedCount: number
}

export function InvoiceList(p: Props) {
  return (
    <Stack gap={0} h="100%">
      <Stack gap="xs" p="sm" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
        <Group justify="space-between">
          <Text fw={600}>Ulazni računi</Text>
          <Text size="xs" c="dimmed">
            {p.confirmedCount} od {p.total} potvrđeno
          </Text>
        </Group>
        <SegmentedControl
          size="xs"
          fullWidth
          value={p.clientFilter}
          onChange={p.onClientFilter}
          data={[{ label: 'Svi', value: 'all' }, ...p.clients.map((c) => ({ label: c.id, value: c.id }))]}
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
          ]}
        />
      </Stack>
      <ScrollArea style={{ flex: 1 }}>
        {p.invoices.map((inv) => {
          const e = p.review(inv.id)
          const open = (p.issues[inv.id] ?? []).filter((i) => !e.resolved.includes(i.key))
          const hasError = open.some((i) => i.severity === 'error')
          const confirmed = e.status === 'confirmed'
          return (
            <UnstyledButton
              key={inv.id}
              onClick={() => p.onSelect(inv.id)}
              p="sm"
              w="100%"
              style={{ borderBottom: '1px solid var(--mantine-color-gray-2)', opacity: confirmed ? 0.6 : 1 }}
              bg={inv.id === p.selectedId ? 'var(--mantine-color-blue-light)' : undefined}
            >
              <Group justify="space-between" wrap="nowrap" gap="xs">
                <Text size="sm" truncate>
                  {inv.fields.vendorName.value}
                </Text>
                {confirmed ? (
                  <Badge color="green" variant="light" size="sm">
                    ✓
                  </Badge>
                ) : open.length > 0 ? (
                  <Badge color={hasError ? 'red' : 'yellow'} variant="light" size="sm">
                    {open.length}
                  </Badge>
                ) : (
                  <Badge color="gray" variant="light" size="sm">
                    čisto
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
