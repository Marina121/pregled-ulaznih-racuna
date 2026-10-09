import { useState, type FC } from 'react'
import { Badge, Button, Group, NumberInput, Select, Stack, Text, TextInput } from '@mantine/core'
import type { FieldMeta } from '../lib/fields'
import type { Issue } from '../lib/checks'
import { LOW_CONFIDENCE } from '../config'
import { bankName, formatAccount, isValidAccount } from '../lib/bankAccounts'
import { isBranch } from '../lib/taxIds'

export type Props = {
  meta: FieldMeta
  value: unknown
  confidence: number
  edited: boolean
  issues: Issue[]
  linked: { issue: Issue; label: string }[]
  wasResolved: boolean
  onChange: (v: unknown) => void
  onClear: () => void
  onResolve: () => void
  locked: boolean
}

const toList = (text: string) =>
  text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

export const FieldRow: FC<Props> = ({
  meta,
  value,
  confidence,
  edited,
  issues,
  linked,
  wasResolved,
  onChange,
  onClear,
  onResolve,
  locked,
}) => {
  // Keeps the typed text, or the comma would be swallowed.
  const listText = Array.isArray(value) ? value.join(', ') : ''
  const [draft, setDraft] = useState(listText)
  if (meta.kind === 'list' && toList(draft).join(', ') !== listText) setDraft(listText)

  const allIssues = [...issues, ...linked.map((link) => link.issue)]
  const flagged = allIssues.length > 0
  const hasValue = value !== null && value !== undefined && value !== ''
  const color = allIssues.some((issue) => issue.severity === 'error') ? 'red' : 'yellow'
  const dismissable = issues.filter((issue) => issue.dismiss)
  const mustFix = issues.some((issue) => !issue.dismiss)

  const input =
    meta.kind === 'select' ? (
      <Select
        size="xs"
        data={meta.options}
        value={meta.options?.some((option) => option.value === value) ? (value as string) : null}
        onChange={(selected) => onChange(selected)}
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
        onChange={(number) =>
          onChange(Number.isFinite(Number(number)) && number !== '' ? Number(number) : null)
        }
        placeholder="nije pronađeno"
        data-field={meta.key}
        readOnly={locked}
      />
    ) : (
      <TextInput
        size="xs"
        value={meta.kind === 'list' ? draft : ((value as string | null) ?? '')}
        onChange={(event) => {
          const typed = event.currentTarget.value
          if (meta.kind === 'list') {
            setDraft(typed)
            onChange(toList(typed))
          } else {
            onChange(typed.trim() === '' ? null : typed)
          }
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
            <Badge
              size="xs"
              variant="light"
              color={confidence < LOW_CONFIDENCE ? 'yellow' : 'gray'}
            >
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
        <Stack gap={2}>
          {(value as string[]).map((account, index) => {
            const valid = isValidAccount(account)
            return (
              <Text key={index} size="xs" c={valid ? 'dimmed' : 'red.8'} ff="monospace">
                {valid ? '✓' : '✗'} {formatAccount(account)}
                <Text span size="xs" ff="text" c={valid ? 'dimmed' : 'red.8'}>
                  {' · '}
                  {bankName(account) ?? 'nepoznata banka'}
                </Text>
              </Text>
            )
          })}
        </Stack>
      )}
      {issues.map((issue) => (
        <Text key={issue.key} size="xs" c={issue.severity === 'error' ? 'red.8' : 'yellow.9'}>
          {issue.message}
        </Text>
      ))}
      {linked.map((link) => (
        <Text key={link.issue.key} size="xs" c="dimmed">
          Vidi upozorenje uz polje „{link.label}”.
        </Text>
      ))}
      {mustFix && !locked && (
        <Text size="xs" c="dimmed">
          Ispravi vrijednost u polju.
        </Text>
      )}
      {dismissable.length > 0 && !locked && (
        <Button
          size="compact-xs"
          variant="light"
          color={color}
          onClick={onResolve}
          style={{ alignSelf: 'flex-start' }}
        >
          {dismissable.some((issue) => issue.dismiss === 'original')
            ? 'Takvo je na originalu'
            : 'Provjereno, u redu je'}
        </Button>
      )}
    </Stack>
  )
}
