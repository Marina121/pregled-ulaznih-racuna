import { useLocalStorage } from '@mantine/hooks'
import type { Edits } from '../lib/checks'
import { STORAGE_KEY } from '../config'

export type ReviewEntry = {
  status: 'pending' | 'confirmed' | 'rejected'
  duplicateOf?: string
  decidedAt?: string
  edits: Edits
  resolved: string[]
}

export type ReviewState = Record<string, ReviewEntry>

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
    setEdit: (id: string, key: string, value: unknown) =>
      update(id, (entry) => ({ ...entry, edits: { ...entry.edits, [key]: value } })),
    // Reopens the field's issues, or an emptied field would stay checked.
    clearEdit: (id: string, key: string, reopenKeys: string[]) =>
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
    reject: (id: string, duplicateOf: string) =>
      update(id, (entry) => ({
        ...entry,
        status: 'rejected',
        duplicateOf,
        decidedAt: new Date().toISOString(),
      })),
    reopen: (id: string) =>
      update(id, (entry) => ({
        ...entry,
        status: 'pending',
        duplicateOf: undefined,
        decidedAt: undefined,
      })),
    resetOne: (id: string) =>
      setState((all) => {
        const next = { ...all }
        delete next[id]
        return next
      }),
  }
}
