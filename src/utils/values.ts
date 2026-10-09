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
  value === '' ||
  (Array.isArray(value) && value.length === 0)

/** For comparing: lower case, no spaces ("1-41 / 22" and "1-41/22" become the same). */
export const normalize = (text: string | null) => (text ?? '').toLowerCase().replace(/\s+/g, '')
