import { useLocalStorage } from '@mantine/hooks'
import type { Edits } from './checks'

export interface ReviewEntry {
  status: 'pending' | 'confirmed'
  edits: Edits
  /** Ključevi problema koje je računovođa pregledao. */
  resolved: string[]
}

export type ReviewState = Record<string, ReviewEntry>

const EMPTY: ReviewEntry = { status: 'pending', edits: {}, resolved: [] }

export function useReview() {
  // Nema backenda: stanje pregleda živi u localStorageu.
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
    clearEdit: (id: string, key: string) =>
      update(id, (e) => {
        const edits = { ...e.edits }
        delete edits[key]
        return { ...e, edits }
      }),
    resolve: (id: string, keys: string[]) =>
      update(id, (e) => ({ ...e, resolved: Array.from(new Set([...e.resolved, ...keys])) })),
    confirm: (id: string) => update(id, (e) => ({ ...e, status: 'confirmed' })),
    reopen: (id: string) => update(id, (e) => ({ ...e, status: 'pending' })),
    resetAll: () => setState({}),
  }
}
