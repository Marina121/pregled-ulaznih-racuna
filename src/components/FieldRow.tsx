import { Badge, Button, Group, NumberInput, Stack, Text, TextInput } from '@mantine/core'
import type { FieldMeta } from '../lib/fields'
import type { Issue } from '../lib/checks'
import { LOW_CONFIDENCE } from '../lib/checks'

interface Props {
  meta: FieldMeta
  value: unknown
  confidence: number
  edited: boolean
  issues: Issue[] // nepregledani problemi za ovo polje
  wasResolved: boolean
  onChange: (v: unknown) => void
  onClear: () => void
  onResolve: () => void
}

export function FieldRow({ meta, value, confidence, edited, issues, wasResolved, onChange, onClear, onResolve }: Props) {
  const flagged = issues.length > 0
  const hasValue = value !== null && value !== undefined && value !== ''
  const color = issues.some((i) => i.severity === 'error') ? 'red' : 'yellow'

  const input =
    meta.kind === 'number' ? (
      <NumberInput
        size="xs"
        value={typeof value === 'number' ? value : ''}
        decimalScale={2}
        decimalSeparator="."
        hideControls
        onChange={(v) => onChange(v === '' ? null : Number(v))}
        placeholder="nije pronađeno"
        data-field={meta.key}
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
            <Badge size="xs" variant="light" color="blue" style={{ cursor: 'pointer' }} onClick={onClear} title="Vrati izvučenu vrijednost">
              izmijenjeno ✕
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
      {issues.map((i) => (
        <Text key={i.key} size="xs" c={i.severity === 'error' ? 'red.8' : 'yellow.9'}>
          {i.message}
        </Text>
      ))}
      {flagged && (
        <Button size="compact-xs" variant="light" color={color} onClick={onResolve} style={{ alignSelf: 'flex-start' }}>
          Provjereno, u redu je
        </Button>
      )}
    </Stack>
  )
}
