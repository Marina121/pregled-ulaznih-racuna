/** The value as text, or null if it isn't text or is only whitespace. */
export const asText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null

/** The value as a number, or null if it isn't a finite number. */
export const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

/** Nothing there: null, undefined, an empty string or an empty list. */
export const isEmpty = (value: unknown) =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0)

/** Same value, whatever its type: "abc" and "abc", 12 and 12, ["a"] and ["a"]. */
export const sameValue = (first: unknown, second: unknown) =>
  JSON.stringify(first ?? null) === JSON.stringify(second ?? null)

/** For comparing: lower case, no spaces ("1-41 / 22" and "1-41/22" become the same). */
export const normalize = (text: string | null) => (text ?? '').toLowerCase().replace(/\s+/g, '')
