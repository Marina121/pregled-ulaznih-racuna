import { useEffect, useState } from 'react'
import { Accordion, Alert, Anchor, Badge, Box, Button, Group, Paper, ScrollArea, Stack, Table, Text, Tooltip } from '@mantine/core'
import type { Invoice } from '../types/invoice'
import { FIELD_META } from '../lib/fields'
import { lineCellUncertain, valueOf, type Issue } from '../lib/checks'
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
  onOpenInvoice: (id: string) => void
  onReject: (duplicateOf: string) => void
  onResetInvoice: () => void
}

// 2022-01-04 → 4. 1. 2022., as dates are written on Croatian/Bosnian invoices.
const fmtDate = (v: unknown) => {
  const m = typeof v === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : null
  return m ? `${Number(m[3])}. ${Number(m[2])}. ${m[1]}.` : v ? String(v) : '—'
}

const fmt = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'number' ? v.toFixed(2).replace(/\.00$/, '') : String(v))

export function FieldsPanel({ invoice, issues, entry, onEdit, onClearEdit, onResolve, onConfirm, onReopen, onOpenInvoice, onReject, onResetInvoice }: Props) {
  const [showRest, setShowRest] = useState(false)
  const open = issues.filter((i) => !entry.resolved.includes(i.key))
  const confirmed = entry.status === 'confirmed'
  const rejected = entry.status === 'rejected'
  // A confirmed or rejected invoice is a decision already made: read-only until "Vrati na pregled".
  const locked = entry.status !== 'pending'
  const hasChanges = Object.keys(entry.edits).length > 0 || entry.resolved.length > 0
  // Undoing all changes on an invoice can't itself be undone, so it asks for a second click:
  // the first click arms it, and it disarms by itself after a few seconds.
  const [resetArmed, setResetArmed] = useState(false)
  useEffect(() => {
    if (!resetArmed) return
    const t = setTimeout(() => setResetArmed(false), 4000)
    return () => clearTimeout(t)
  }, [resetArmed])
  const docIssues = issues.filter((i) => i.fields.length === 0)
  const total = valueOf(invoice, entry.edits, 'totalAmount')
  const openFor = (k: string) => open.filter((i) => (i.fields as string[]).includes(k))
  // A field that was flagged once stays at the top while the invoice is open.
  // Otherwise it would disappear as soon as an edit fixes the issue, mid-typing.
  // The panel has key={invoice.id}, so the list starts fresh for each invoice.
  const openKeys: string[] = open.flatMap((i) => i.fields)
  const [flaggedKeys, setFlaggedKeys] = useState(() => new Set(openKeys))
  if (openKeys.some((k) => !flaggedKeys.has(k))) {
    setFlaggedKeys(new Set([...flaggedKeys, ...openKeys]))
  }
  const flaggedMeta = FIELD_META.filter((m) => flaggedKeys.has(m.key))
  const restMeta = FIELD_META.filter((m) => !flaggedKeys.has(m.key))

  // An issue that spans several fields (e.g. two dates) is written only on the first one;
  // the other fields are just highlighted, so the same message isn't repeated two or three times.
  const firstFieldOf = (i: Issue) => FIELD_META.find((m) => i.fields.includes(m.key))
  const row = (m: (typeof FIELD_META)[number]) => {
    const touching = issues.filter((i) => (i.fields as string[]).includes(m.key))
    const own = openFor(m.key).filter((i) => firstFieldOf(i)?.key === m.key)
    const linked = openFor(m.key)
      .filter((i) => firstFieldOf(i)?.key !== m.key)
      .map((i) => ({ issue: i, label: firstFieldOf(i)?.label ?? '' }))
    return (
      <FieldRow
        key={m.key}
        meta={m}
        value={valueOf(invoice, entry.edits, m.key)}
        confidence={invoice.fields[m.key].confidence}
        edited={entry.edits[m.key] !== undefined}
        issues={own}
        linked={linked}
        wasResolved={touching.some((i) => entry.resolved.includes(i.key))}
        locked={locked}
        onChange={(v) => onEdit(m.key, v, touching.map((i) => i.key))}
        onClear={() => onClearEdit(m.key)}
        onResolve={() => onResolve(own.map((i) => i.key))}
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
                {confirmed ? 'Račun je potvrđen' : 'Račun je odbačen'} i zaključan. Za izmjene klikni „Vrati na
                pregled”.
              </Text>
            </Alert>
          )}

          {/* Nothing left to check: instead of an empty panel, show what is being confirmed. */}
          {open.length === 0 && (
            <>
              {entry.status === 'pending' && (
                <Alert color="teal" variant="light" title={issues.length === 0 ? 'Sve automatske provjere su prošle' : 'Sve je provjereno'}>
                  Usporedi sažetak s originalom i potvrdi.
                </Alert>
              )}
              <Paper withBorder p="sm">
                <Stack gap={6}>
                  {[
                    ['Dobavljač', valueOf(invoice, entry.edits, 'vendorName')],
                    ['Broj računa', valueOf(invoice, entry.edits, 'invoiceNumber')],
                    ['Datum računa', fmtDate(valueOf(invoice, entry.edits, 'issueDate'))],
                    ['Dospijeće', fmtDate(valueOf(invoice, entry.edits, 'dueDate'))],
                  ].map(([label, val]) => (
                    <Group key={String(label)} justify="space-between" wrap="nowrap">
                      <Text size="xs" c="dimmed">
                        {String(label)}
                      </Text>
                      <Text size="sm" ta="right">
                        {val ? String(val) : '—'}
                      </Text>
                    </Group>
                  ))}
                  <Group justify="space-between" pt={6} style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
                    <Text size="sm" fw={600}>
                      Ukupno
                    </Text>
                    <Text size="lg" fw={700}>
                      {typeof total === 'number' ? total.toFixed(2) : '—'} {String(valueOf(invoice, entry.edits, 'currency') ?? '')}
                    </Text>
                  </Group>
                </Stack>
              </Paper>
            </>
          )}

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
                  <Text size="xs" c={resolved ? 'dimmed' : undefined} style={{ flex: 1 }}>
                    {i.message}
                    {i.relatedId && (
                      <>
                        {' '}
                        <Anchor
                          component="button"
                          size="xs"
                          c="inherit"
                          fw={700}
                          underline="always"
                          onClick={() => onOpenInvoice(i.relatedId!)}
                        >
                          Otvori {i.relatedId} →
                        </Anchor>
                      </>
                    )}
                  </Text>
                  {resolved ? (
                    <Text size="xs" c="green">
                      ✓
                    </Text>
                  ) : locked ? null : i.relatedId ? (
                    // For duplicates "checked" means nothing: the accountant must say whether it is one or not.
                    <Stack gap={4} style={{ flexShrink: 0 }}>
                      <Button size="compact-xs" variant="white" color="dark" onClick={() => onResolve([i.key])}>
                        Nije duplikat
                      </Button>
                      <Button size="compact-xs" variant="white" color="red" onClick={() => onReject(i.relatedId!)}>
                        Duplikat je, odbaci
                      </Button>
                    </Stack>
                  ) : (
                    <Button
                      size="compact-xs"
                      variant="white"
                      color="dark"
                      onClick={() => onResolve([i.key])}
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
                                bg={
                                  // After "Provjereno" the highlight goes away, like with the other warnings.
                                  !entry.resolved.includes('linesConf') && lineCellUncertain(l, k)
                                    ? 'var(--mantine-color-yellow-1)'
                                    : undefined
                                }
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
