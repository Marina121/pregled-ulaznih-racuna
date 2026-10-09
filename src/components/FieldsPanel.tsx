import { useState } from 'react'
import { Accordion, Alert, Badge, Box, Button, Group, ScrollArea, Stack, Table, Text, Tooltip } from '@mantine/core'
import type { Invoice } from '../types/invoice'
import { FIELD_META } from '../lib/fields'
import { LOW_CONFIDENCE, valueOf, type Issue } from '../lib/checks'
import type { ReviewEntry } from '../lib/review'
import { FieldRow } from './FieldRow'

interface Props {
  invoice: Invoice
  issues: Issue[]
  entry: ReviewEntry
  onEdit: (key: string, value: unknown, resolveKeys: string[]) => void
  onClearEdit: (key: string) => void
  onResolve: (keys: string[]) => void
  onConfirm: () => void
  onReopen: () => void
}

const fmt = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'number' ? v.toFixed(2).replace(/\.00$/, '') : String(v))

export function FieldsPanel({ invoice, issues, entry, onEdit, onClearEdit, onResolve, onConfirm, onReopen }: Props) {
  const [showRest, setShowRest] = useState(false)
  const open = issues.filter((i) => !entry.resolved.includes(i.key))
  const confirmed = entry.status === 'confirmed'
  const docIssues = issues.filter((i) => i.fields.length === 0)
  const openFor = (k: string) => open.filter((i) => (i.fields as string[]).includes(k))
  const flaggedMeta = FIELD_META.filter((m) => openFor(m.key).length > 0)
  const restMeta = FIELD_META.filter((m) => openFor(m.key).length === 0)

  const row = (m: (typeof FIELD_META)[number]) => {
    const touching = issues.filter((i) => (i.fields as string[]).includes(m.key))
    return (
      <FieldRow
        key={m.key}
        meta={m}
        value={valueOf(invoice, entry.edits, m.key)}
        confidence={invoice.fields[m.key].confidence}
        edited={entry.edits[m.key] !== undefined}
        issues={openFor(m.key)}
        wasResolved={touching.some((i) => entry.resolved.includes(i.key))}
        onChange={(v) => onEdit(m.key, v, touching.map((i) => i.key))}
        onClear={() => onClearEdit(m.key)}
        onResolve={() => onResolve(openFor(m.key).map((i) => i.key))}
      />
    )
  }

  return (
    <Box h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
      <Group justify="space-between" p="sm" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
        <Box>
          <Text fw={600}>{invoice.fields.vendorName.value}</Text>
          <Text size="xs" c="dimmed">
            {invoice.id} · klijent {invoice.client.name}
          </Text>
        </Box>
        {confirmed && (
          <Badge color="green" variant="filled">
            Potvrđeno
          </Badge>
        )}
      </Group>

      <ScrollArea style={{ flex: 1 }} p="sm">
        <Stack gap="sm" p="sm">
          {docIssues.map((i) => {
            const resolved = entry.resolved.includes(i.key)
            return (
              <Alert
                key={i.key}
                color={resolved ? 'gray' : i.severity === 'error' ? 'red' : 'yellow'}
                variant={resolved ? 'light' : 'filled'}
                p="xs"
              >
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <Text size="xs" c={resolved ? 'dimmed' : undefined}>
                    {i.message}
                  </Text>
                  {resolved ? (
                    <Text size="xs" c="green">
                      ✓
                    </Text>
                  ) : (
                    <Button size="compact-xs" variant="white" color="dark" onClick={() => onResolve([i.key])}>
                      Provjereno
                    </Button>
                  )}
                </Group>
              </Alert>
            )
          })}

          {flaggedMeta.length > 0 && (
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">
              Za provjeru ({flaggedMeta.length})
            </Text>
          )}
          {flaggedMeta.map(row)}

          <Button variant="subtle" size="compact-sm" onClick={() => setShowRest((s) => !s)} style={{ alignSelf: 'flex-start' }}>
            {showRest ? 'Sakrij' : 'Prikaži'} ostala polja ({restMeta.length})
          </Button>
          {showRest && restMeta.map(row)}

          {invoice.lineItems.length > 0 && (
            <Accordion variant="contained">
              <Accordion.Item value="lines">
                <Accordion.Control>Stavke ({invoice.lineItems.length})</Accordion.Control>
                <Accordion.Panel>
                  <ScrollArea>
                    <Table fz="xs" withRowBorders>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Opis</Table.Th>
                          <Table.Th>Kol.</Table.Th>
                          <Table.Th>Cijena</Table.Th>
                          <Table.Th>PDV</Table.Th>
                          <Table.Th>Iznos</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {invoice.lineItems.map((l, idx) => (
                          <Table.Tr key={idx}>
                            {(['description', 'quantity', 'unitPrice', 'vatRate', 'lineTotal'] as const).map((k) => (
                              <Table.Td
                                key={k}
                                bg={l[k].value !== null && l[k].confidence < LOW_CONFIDENCE ? 'var(--mantine-color-yellow-1)' : undefined}
                              >
                                {fmt(l[k].value)}
                                {k === 'quantity' && l.unit.value ? ` ${l.unit.value}` : ''}
                              </Table.Td>
                            ))}
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                  <Text size="xs" c="dimmed" mt="xs">
                    Stavke se samo pregledavaju, ne uređuju.
                  </Text>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          )}
        </Stack>
      </ScrollArea>

      <Group justify="space-between" p="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
        <Text size="xs" c="dimmed">
          {issues.length === 0 ? 'Nema upozorenja' : `${issues.length - open.length} od ${issues.length} provjereno`}
        </Text>
        {confirmed ? (
          <Button variant="default" size="xs" onClick={onReopen}>
            Vrati na pregled
          </Button>
        ) : (
          <Tooltip label={`Još ${open.length} stavki za provjeru`} disabled={open.length === 0}>
            <Button size="xs" disabled={open.length > 0} onClick={onConfirm}>
              Potvrdi i idi na sljedeći (Ctrl+Enter)
            </Button>
          </Tooltip>
        )}
      </Group>
    </Box>
  )
}
