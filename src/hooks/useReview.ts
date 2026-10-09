import { useLocalStorage } from '@mantine/hooks'
import type { Edits } from '../lib/checks'
import { STORAGE_KEY } from '../config'

export type ReviewEntry = {
  // Rejected = a duplicate that is not booked. Never deleted, so the decision stays visible and
  // reversible.
  status: 'pending' | 'confirmed' | 'rejected'
  /** For a rejected invoice: which invoice is the original. */
  duplicateOf?: string
  /** When the invoice was confirmed or rejected (ISO time). With a backend this would also
   * record who; without one, a login would only be for show. */
  decidedAt?: string
  edits: Edits
  /** Keys of the issues the accountant has reviewed. */
  resolved: string[]
}

export type ReviewState = Record<string, ReviewEntry>

const EMPTY: ReviewEntry = { status: 'pending', edits: {}, resolved: [] }

export const useReview = () => {
  // No backend: review state lives in localStorage.
  const [state, setState] = useLocalStorage<ReviewState>({
    key: STORAGE_KEY,
    defaultValue: {},
  })

  const update = (id: string, change: (entry: ReviewEntry) => ReviewEntry) =>
    setState((all) => ({ ...all, [id]: change(all[id] ?? EMPTY) }))

  return {
    state,
    get: (id: string): ReviewEntry => state[id] ?? EMPTY,
    // An edit doesn't mark anything as checked. Issues are recomputed from the new value: a good
    // correction makes them disappear, a bad one keeps (or creates) them. Marking them checked
    // here used to hide the warning a mistyped amount had just caused.
    setEdit: (id: string, key: string, value: unknown) =>
      update(id, (entry) => ({ ...entry, edits: { ...entry.edits, [key]: value } })),
    // Undoing an edit also reopens the issues on that field. Otherwise a field reverted to empty
    // would stay marked as checked, and the invoice could be confirmed without it.
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
    // Back to how the system read it: no edits, nothing checked, pending.
    resetOne: (id: string) =>
      setState((all) => {
        const next = { ...all }
        delete next[id]
        return next
      }),
  }
}
