import { Badge, Button, Group, NumberInput, Select, Stack, Text, TextInput } from '@mantine/core'
import type { FieldMeta } from '../lib/fields'
import type { Issue } from '../lib/checks'
import { LOW_CONFIDENCE } from '../lib/checks'
import { bankName, formatAccount, isValidAccount } from '../lib/bankAccounts'
import { isBranch } from '../lib/taxIds'

interface Props {
  meta: FieldMeta
  value: unknown
  confidence: number
  edited: boolean
  issues: Issue[] // unreviewed issues whose message is shown on this field
  linked: { issue: Issue; label: string }[] // issues whose message is shown on another field
  wasResolved: boolean
  onChange: (v: unknown) => void
  onClear: () => void
  onResolve: () => void
  locked: boolean // invoice confirmed or rejected: show values, allow no changes
}

export function FieldRow({ meta, value, confidence, edited, issues, linked, wasResolved, onChange, onClear, onResolve, locked }: Props) {
  const all = [...issues, ...linked.map((l) => l.issue)]
  const flagged = all.length > 0
  const hasValue = value !== null && value !== undefined && value !== ''
  const color = all.some((i) => i.severity === 'error') ? 'red' : 'yellow'

  const input =
    meta.kind === 'select' ? (
      <Select
        size="xs"
        data={meta.options}
        // A value the reader returned that isn't an option (e.g. "KM") is shown as empty here;
        // the check in checks.ts explains what was read.
        value={meta.options?.some((o) => o.value === value) ? (value as string) : null}
        onChange={(v) => onChange(v)}
        allowDeselect={false}
        placeholder="odaberi"
        data-field={meta.key}
        readOnly={locked}
      />
    ) : meta.kind === 'number' ? (
      <NumberInput
        size="xs"
        value={typeof value === 'number' ? value : ''}
        decimalScale={2}
        decimalSeparator="."
        hideControls
        onChange={(v) => onChange(v === '' ? null : Number(v))}
        placeholder="nije pronađeno"
        data-field={meta.key}
        readOnly={locked}
      />
    ) : (
      <TextInput
        size="xs"
        value={meta.kind === 'list' ? ((value as string[] | null) ?? []).join(', ') : ((value as string | null) ?? '')}
        onChange={(e) => {
          const t = e.currentTarget.value
          onChange(meta.kind === 'list' ? t.split(',').map((s) => s.trim()).filter(Boolean) : t === '' ? null : t)
        }}
        placeholder={meta.kind === 'date' ? 'GGGG-MM-DD' : 'nije pronađeno'}
        data-field={meta.key}
        readOnly={locked}
      />
    )

  return (
    <Stack
      gap={4}
      p="xs"
      style={{
        borderRadius: 6,
        border: flagged ? `1px solid var(--mantine-color-${color}-4)` : '1px solid transparent',
        background: flagged ? `var(--mantine-color-${color}-0)` : undefined,
      }}
    >
      <Group justify="space-between" gap="xs">
        <Text size="xs" fw={600}>
          {meta.label}
        </Text>
        <Group gap={4}>
          {edited && (
            <Badge
              size="xs"
              variant="light"
              color="blue"
              style={{ cursor: locked ? undefined : 'pointer' }}
              onClick={locked ? undefined : onClear}
              title={locked ? undefined : 'Vrati izvučenu vrijednost'}
            >
              {locked ? 'izmijenjeno' : 'izmijenjeno ✕'}
            </Badge>
          )}
          {!edited && hasValue && (
            <Badge size="xs" variant="light" color={confidence < LOW_CONFIDENCE ? 'yellow' : 'gray'}>
              {Math.round(confidence * 100)}%
            </Badge>
          )}
          {wasResolved && !flagged && (
            <Badge size="xs" variant="light" color="green">
              provjereno ✓
            </Badge>
          )}
        </Group>
      </Group>
      {input}
      {meta.key === 'vendorTaxId' && typeof value === 'string' && isBranch(value) && (
        <Text size="xs" c="dimmed">
          Račun je izdala poslovnica, pa se ID broj razlikuje od PDV broja firme. To je u redu.
        </Text>
      )}
      {meta.key === 'bankAccounts' && Array.isArray(value) && value.length > 0 && (
        // Raw digits are hard to compare with the original: group them as printed, with the bank name.
        <Stack gap={2}>
          {(value as string[]).map((a, idx) => {
            const ok = isValidAccount(a)
            return (
              <Text key={idx} size="xs" c={ok ? 'dimmed' : 'red.8'} ff="monospace">
                {ok ? '✓' : '✗'} {formatAccount(a)}
                <Text span size="xs" ff="text" c={ok ? 'dimmed' : 'red.8'}>
                  {' · '}
                  {bankName(a) ?? 'nepoznata banka'}
                </Text>
              </Text>
            )
          })}
        </Stack>
      )}
      {issues.map((i) => (
        <Text key={i.key} size="xs" c={i.severity === 'error' ? 'red.8' : 'yellow.9'}>
          {i.message}
        </Text>
      ))}
      {linked.map((l) => (
        <Text key={l.issue.key} size="xs" c="dimmed">
          ↑ Vidi upozorenje uz polje „{l.label}”.
        </Text>
      ))}
      {issues.length > 0 && !locked && (
        <Button size="compact-xs" variant="light" color={color} onClick={onResolve} style={{ alignSelf: 'flex-start' }}>
          Provjereno, u redu je
        </Button>
      )}
    </Stack>
  )
}
