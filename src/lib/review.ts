import { useLocalStorage } from '@mantine/hooks'
import type { Edits } from './checks'

export interface ReviewEntry {
  // Rejected = a duplicate that is not booked. Never deleted, so the decision stays visible and reversible.
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

export function useReview() {
  // No backend: review state lives in localStorage.
  const [state, setState] = useLocalStorage<ReviewState>({ key: 'racuni-pregled-v1', defaultValue: {} })

  const update = (id: string, fn: (e: ReviewEntry) => ReviewEntry) =>
    setState((s) => ({ ...s, [id]: fn(s[id] ?? EMPTY) }))

  return {
    state,
    get: (id: string): ReviewEntry => state[id] ?? EMPTY,
    setEdit: (id: string, key: string, value: unknown, resolveKeys: string[]) =>
      update(id, (e) => ({
        ...e,
        edits: { ...e.edits, [key]: value },
        resolved: Array.from(new Set([...e.resolved, ...resolveKeys])),
      })),
    // Undoing an edit also reopens the issues on that field. Otherwise a field reverted to empty
    // would stay marked as checked, and the invoice could be confirmed without it.
    clearEdit: (id: string, key: string, reopenKeys: string[]) =>
      update(id, (e) => {
        const edits = { ...e.edits }
        delete edits[key]
        return { ...e, edits, resolved: e.resolved.filter((k) => !reopenKeys.includes(k)) }
      }),
    resolve: (id: string, keys: string[]) =>
      update(id, (e) => ({ ...e, resolved: Array.from(new Set([...e.resolved, ...keys])) })),
    confirm: (id: string) => update(id, (e) => ({ ...e, status: 'confirmed', decidedAt: new Date().toISOString() })),
    reject: (id: string, duplicateOf: string) =>
      update(id, (e) => ({ ...e, status: 'rejected', duplicateOf, decidedAt: new Date().toISOString() })),
    reopen: (id: string) =>
      update(id, (e) => ({ ...e, status: 'pending', duplicateOf: undefined, decidedAt: undefined })),
    // Back to how the system read it: no edits, nothing checked, pending.
    resetOne: (id: string) =>
      setState((s) => {
        const next = { ...s }
        delete next[id]
        return next
      }),
  }
}
