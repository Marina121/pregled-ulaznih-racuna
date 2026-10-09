import { useState, type FC } from 'react'
import { Badge, Button, Group, NumberInput, Select, Stack, Text, TextInput } from '@mantine/core'
import type { FieldValue } from '../types/review'
import type { FieldMeta } from '../lib/fields'
import type { Issue } from '../lib/checks'
import { bankName, formatAccount, isValidAccount } from '../lib/bankAccounts'
import { isBranch } from '../lib/taxIds'
import { isEmpty, sameValue } from '../utils/values'
import { dateInputText, parseDate } from '../utils/dates'
import { LOW_CONFIDENCE } from '../config'

export type Props = {
  meta: FieldMeta
  value: FieldValue
  confidence: number
  edited: boolean
  issues: Issue[]
  linked: { issue: Issue; label: string }[]
  wasResolved: boolean
  onChange: (value: FieldValue) => void
  onClear: () => void
  onResolve: () => void
  onRejectOtherClient: () => void
  locked: boolean
}

const toList = (text: string) =>
  text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

// What a typed text is stored as. A date typed as "11.1.2022." is stored as 2022-01-11; text that
// isn't a date (yet) is stored as typed, so the check can say what's wrong with it.
const fromText = (kind: FieldMeta['kind'], text: string): FieldValue => {
  if (kind === 'list') return toList(text)
  if (text.trim() === '') return null
  return kind === 'date' ? (parseDate(text) ?? text) : text
}

// What a stored value is shown as in a text input.
const toText = (kind: FieldMeta['kind'], value: FieldValue) => {
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value !== 'string') return ''
  return kind === 'date' ? dateInputText(value) : value
}

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
  onRejectOtherClient,
  locked,
}) => {
  // Keeps the typed text: otherwise a list would swallow the comma, and a date typed as 11.1.2022.
  // would turn into 2022-01-11 halfway through typing. It follows the value when that changes from
  // outside (e.g. "Poništi izmjene").
  const [draft, setDraft] = useState(() => toText(meta.kind, value))
  const typedIn = meta.kind === 'text' || meta.kind === 'date' || meta.kind === 'list'
  if (typedIn && !sameValue(fromText(meta.kind, draft), value)) {
    setDraft(toText(meta.kind, value))
  }

  const allIssues = [...issues, ...linked.map((link) => link.issue)]
  const flagged = allIssues.length > 0
  const hasValue = !isEmpty(value)
  const color = allIssues.some((issue) => issue.severity === 'error') ? 'red' : 'yellow'
  const dismissable = issues.filter((issue) => issue.dismiss)
  const mustFix = issues.some((issue) => !issue.dismiss)
  const otherClient = issues.some((issue) => issue.reject === 'otherClient')

  const input =
    meta.kind === 'select' ? (
      <Select
        size="xs"
        data={meta.options}
        value={
          typeof value === 'string' && meta.options?.some((option) => option.value === value)
            ? value
            : null
        }
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
        value={draft}
        onChange={(event) => {
          setDraft(event.currentTarget.value)
          onChange(fromText(meta.kind, event.currentTarget.value))
        }}
        placeholder={meta.kind === 'date' ? 'npr. 11. 1. 2022.' : 'nije pronađeno'}
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
          {value.map((account, index) => {
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
      {mustFix && !otherClient && !locked && (
        <Text size="xs" c="dimmed">
          Ispravi vrijednost u polju.
        </Text>
      )}
      {otherClient && !locked && (
        <Button
          size="compact-xs"
          variant="light"
          color="red"
          onClick={onRejectOtherClient}
          style={{ alignSelf: 'flex-start' }}
        >
          Račun je za drugu firmu, odbaci
        </Button>
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
