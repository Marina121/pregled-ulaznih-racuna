import { useLocalStorage } from '@mantine/hooks'
import type { FieldKey, FieldValue, RejectReason, ReviewEntry, ReviewState } from '../types/review'
import { STORAGE_KEY } from '../config'

const EMPTY: ReviewEntry = { status: 'pending', edits: {}, resolved: [] }

export const useReview = () => {
  const [state, setState] = useLocalStorage<ReviewState>({
    key: STORAGE_KEY,
    defaultValue: {},
  })

  const update = (id: string, change: (entry: ReviewEntry) => ReviewEntry) =>
    setState((all) => ({ ...all, [id]: change(all[id] ?? EMPTY) }))

  return {
    state,
    get: (id: string): ReviewEntry => state[id] ?? EMPTY,
    // Doesn't mark as checked: otherwise a mistyped amount would hide its own warning.
    setEdit: (id: string, key: FieldKey, value: FieldValue) =>
      update(id, (entry) => ({ ...entry, edits: { ...entry.edits, [key]: value } })),
    // Reopens the field's issues, or an emptied field would stay checked.
    clearEdit: (id: string, key: FieldKey, reopenKeys: string[]) =>
      update(id, (entry) => {
        const edits = { ...entry.edits }
        delete edits[key]
        return {
          ...entry,
          edits,
          resolved: entry.resolved.filter((resolvedKey) => !reopenKeys.includes(resolvedKey)),
        }
      }),
    resolve: (id: string, keys: string[]) =>
      update(id, (entry) => ({
        ...entry,
        resolved: Array.from(new Set([...entry.resolved, ...keys])),
      })),
    confirm: (id: string) =>
      update(id, (entry) => ({
        ...entry,
        status: 'confirmed',
        decidedAt: new Date().toISOString(),
      })),
    reject: (id: string, reason: RejectReason) =>
      update(id, (entry) => ({
        ...entry,
        ...reason,
        status: 'rejected',
        decidedAt: new Date().toISOString(),
      })),
    reopen: (id: string) =>
      update(id, (entry) => ({
        ...entry,
        status: 'pending',
        duplicateOf: undefined,
        otherClient: undefined,
        decidedAt: undefined,
      })),
    // Puts back an entry as it was, to undo "Poništi izmjene".
    restore: (id: string, entry: ReviewEntry) => update(id, () => entry),
    resetOne: (id: string) =>
      setState((all) => {
        const next = { ...all }
        delete next[id]
        return next
      }),
  }
}
