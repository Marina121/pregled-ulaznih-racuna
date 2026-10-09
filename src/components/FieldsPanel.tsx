import { useEffect, useState, type FC } from 'react'
import {
  Accordion,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core'
import type { Invoice } from '../types/invoice'
import { FIELD_META } from '../lib/fields'
import { lineCellUncertain, valueOf, type Issue } from '../lib/checks'
import { changesOf } from '../lib/export'
import { formatDate, formatDateTime } from '../utils/dates'
import { CONFIRM_SECOND_CLICK_MS } from '../config'
import type { ReviewEntry } from '../hooks/useReview'
import { FieldRow } from './FieldRow'

export type Props = {
  invoice: Invoice
  issues: Issue[]
  entry: ReviewEntry
  onEdit: (key: string, value: unknown) => void
  onClearEdit: (key: string) => void
  onResolve: (keys: string[]) => void
  onConfirm: () => void
  onReopen: () => void
  onOpenInvoice: (id: string) => void
  onReject: (duplicateOf: string) => void
  onResetInvoice: () => void
}

const formatCell = (value: unknown) =>
  value === null || value === undefined
    ? '—'
    : typeof value === 'number'
      ? value.toFixed(2).replace(/\.00$/, '')
      : String(value)

export const FieldsPanel: FC<Props> = ({
  invoice,
  issues,
  entry,
  onEdit,
  onClearEdit,
  onResolve,
  onConfirm,
  onReopen,
  onOpenInvoice,
  onReject,
  onResetInvoice,
}) => {
  const [showRest, setShowRest] = useState(false)
  const [resetArmed, setResetArmed] = useState(false)

  const open = issues.filter((issue) => !entry.resolved.includes(issue.key))
  const confirmed = entry.status === 'confirmed'
  const rejected = entry.status === 'rejected'
  const locked = entry.status !== 'pending'
  const hasChanges = Object.keys(entry.edits).length > 0 || entry.resolved.length > 0
  const docIssues = issues.filter((issue) => issue.fields.length === 0)
  const total = valueOf(invoice, entry.edits, 'totalAmount')
  const changes = changesOf(invoice, entry.edits)
  const summaryRows = [
    { label: 'Dobavljač', value: valueOf(invoice, entry.edits, 'vendorName') },
    { label: 'Broj računa', value: valueOf(invoice, entry.edits, 'invoiceNumber') },
    { label: 'Datum računa', value: formatDate(valueOf(invoice, entry.edits, 'issueDate')) },
    { label: 'Dospijeće', value: formatDate(valueOf(invoice, entry.edits, 'dueDate')) },
  ]
  const openFor = (key: string) => open.filter((issue) => (issue.fields as string[]).includes(key))

  // A visible field never moves, or typing in it would lose focus.
  const openKeys: string[] = open.flatMap((issue) => issue.fields)
  const [flaggedKeys, setFlaggedKeys] = useState(() => new Set(openKeys))
  if (!showRest && openKeys.some((key) => !flaggedKeys.has(key))) {
    setFlaggedKeys(new Set([...flaggedKeys, ...openKeys]))
  }
  const flaggedMeta = FIELD_META.filter((field) => flaggedKeys.has(field.key))
  const restMeta = FIELD_META.filter((field) => !flaggedKeys.has(field.key))

  const firstFieldOf = (issue: Issue) =>
    FIELD_META.find((field) => issue.fields.includes(field.key))

  const row = (field: (typeof FIELD_META)[number]) => {
    const touching = issues.filter((issue) => (issue.fields as string[]).includes(field.key))
    const own = openFor(field.key).filter((issue) => firstFieldOf(issue)?.key === field.key)
    const linked = openFor(field.key)
      .filter((issue) => firstFieldOf(issue)?.key !== field.key)
      .map((issue) => ({ issue, label: firstFieldOf(issue)?.label ?? '' }))
    return (
      <FieldRow
        key={field.key}
        meta={field}
        value={valueOf(invoice, entry.edits, field.key)}
        confidence={invoice.fields[field.key].confidence}
        edited={entry.edits[field.key] !== undefined}
        issues={own}
        linked={linked}
        wasResolved={touching.some((issue) => entry.resolved.includes(issue.key))}
        locked={locked}
        onChange={(value) => onEdit(field.key, value)}
        onClear={() => onClearEdit(field.key)}
        onResolve={() => onResolve(own.map((issue) => issue.key))}
      />
    )
  }

  useEffect(() => {
    if (!resetArmed) return
    const timer = setTimeout(() => setResetArmed(false), CONFIRM_SECOND_CLICK_MS)
    return () => clearTimeout(timer)
  }, [resetArmed])

  return (
    <Box h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
      <Group
        justify="space-between"
        p="sm"
        style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
      >
        <Box>
          <Text fw={600}>{String(valueOf(invoice, entry.edits, 'vendorName') ?? '')}</Text>
          <Text size="xs" c="dimmed">
            {invoice.id} · klijent {invoice.client.name}
          </Text>
        </Box>
        {confirmed && (
          <Badge color="green" variant="filled">
            Potvrđeno
          </Badge>
        )}
        {!locked && hasChanges && (
          <Button
            size="compact-xs"
            variant={resetArmed ? 'filled' : 'subtle'}
            color={resetArmed ? 'red' : 'gray'}
            onClick={() => {
              if (!resetArmed) return setResetArmed(true)
              onResetInvoice()
              setResetArmed(false)
            }}
          >
            {resetArmed ? 'Sigurno? Klikni opet' : 'Poništi izmjene'}
          </Button>
        )}
        {rejected && (
          <Badge color="gray" variant="filled">
            Odbačeno · duplikat {entry.duplicateOf}
          </Badge>
        )}
      </Group>

      <ScrollArea style={{ flex: 1 }} p="sm">
        <Stack gap="sm" p="sm">
          {locked && (
            <Alert color="gray" variant="light" p="xs">
              <Text size="xs">
                {confirmed ? 'Račun je potvrđen' : 'Račun je odbačen'}
                {entry.decidedAt ? ` ${formatDateTime(entry.decidedAt)}` : ''} i zaključan. Za
                izmjene klikni „Vrati na pregled”.
              </Text>
            </Alert>
          )}

          {open.length === 0 && (
            <>
              {entry.status === 'pending' && (
                <Alert
                  color="teal"
                  variant="light"
                  title={
                    issues.length === 0 ? 'Sve automatske provjere su prošle' : 'Sve je provjereno'
                  }
                >
                  Usporedi sažetak s originalom i potvrdi.
                </Alert>
              )}
              <Paper withBorder p="sm">
                <Stack gap={6}>
                  {summaryRows.map((row) => (
                    <Group key={row.label} justify="space-between" wrap="nowrap">
                      <Text size="xs" c="dimmed">
                        {row.label}
                      </Text>
                      <Text size="sm" ta="right">
                        {row.value ? String(row.value) : '—'}
                      </Text>
                    </Group>
                  ))}
                  <Group
                    justify="space-between"
                    pt={6}
                    style={{
                      borderTop: '1px solid var(--mantine-color-gray-2)',
                    }}
                  >
                    <Text size="sm" fw={600}>
                      Ukupno
                    </Text>
                    <Text size="lg" fw={700}>
                      {typeof total === 'number' ? total.toFixed(2) : '—'}{' '}
                      {String(valueOf(invoice, entry.edits, 'currency') ?? '')}
                    </Text>
                  </Group>
                  {changes.length > 0 && (
                    <Stack
                      gap={2}
                      pt={6}
                      style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}
                    >
                      <Text size="xs" c="dimmed">
                        Ispravljeno
                      </Text>
                      {changes.map((change) => (
                        <Text key={change.label} size="xs">
                          <b>{change.label}:</b> {change.from} → {change.to}
                        </Text>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </Paper>
            </>
          )}

          {docIssues.map((issue) => {
            const resolved = entry.resolved.includes(issue.key)
            return (
              <Alert
                key={issue.key}
                color={resolved ? 'gray' : issue.severity === 'error' ? 'red' : 'yellow'}
                variant={resolved ? 'light' : 'filled'}
                p="xs"
              >
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <Text size="xs" c={resolved ? 'dimmed' : undefined} style={{ flex: 1 }}>
                    {issue.message}
                    {issue.relatedId && (
                      <>
                        {' '}
                        <Anchor
                          component="button"
                          size="xs"
                          c="inherit"
                          fw={700}
                          underline="always"
                          onClick={() => onOpenInvoice(issue.relatedId!)}
                        >
                          Otvori {issue.relatedId} →
                        </Anchor>
                      </>
                    )}
                  </Text>
                  {resolved ? (
                    <Text size="xs" c="green">
                      ✓
                    </Text>
                  ) : locked ? null : issue.relatedId ? (
                    <Stack gap={4} style={{ flexShrink: 0 }}>
                      <Button
                        size="compact-xs"
                        variant="white"
                        color="dark"
                        onClick={() => onResolve([issue.key])}
                      >
                        Nije duplikat
                      </Button>
                      <Button
                        size="compact-xs"
                        variant="white"
                        color="red"
                        onClick={() => onReject(issue.relatedId!)}
                      >
                        Duplikat je, odbaci
                      </Button>
                    </Stack>
                  ) : (
                    <Button
                      size="compact-xs"
                      variant="white"
                      color="dark"
                      onClick={() => onResolve([issue.key])}
                      style={{ flexShrink: 0 }}
                    >
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

          <Button
            variant="subtle"
            size="compact-sm"
            onClick={() => setShowRest((shown) => !shown)}
            style={{ alignSelf: 'flex-start' }}
          >
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
                        {invoice.lineItems.map((line, index) => (
                          <Table.Tr key={index}>
                            {(
                              [
                                'description',
                                'quantity',
                                'unitPrice',
                                'vatRate',
                                'lineTotal',
                              ] as const
                            ).map((column) => (
                              <Table.Td
                                key={column}
                                bg={
                                  !entry.resolved.includes('linesConf') &&
                                  lineCellUncertain(line, column)
                                    ? 'var(--mantine-color-yellow-1)'
                                    : undefined
                                }
                              >
                                {formatCell(line[column].value)}
                                {column === 'quantity' && line.unit.value
                                  ? ` ${line.unit.value}`
                                  : ''}
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

      <Group
        justify="space-between"
        p="sm"
        style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}
      >
        <Text size="xs" c="dimmed">
          {issues.length === 0
            ? 'Nema upozorenja'
            : `${issues.length - open.length} od ${issues.length} provjereno`}
        </Text>
        {confirmed || rejected ? (
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
