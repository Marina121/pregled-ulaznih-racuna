/**
 * A real date in YYYY-MM-DD form. 2022-02-30 is rejected (Date would roll it over to March), and
 * so is 2022-13-01 (an invalid Date, whose toISOString would throw).
 */
export const isIsoDate = (text: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const date = new Date(`${text}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text)
}

/** 2022-01-04 → 4. 1. 2022., as dates are written on Croatian/Bosnian invoices. */
export const formatDate = (value: unknown) => {
  const match = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null
  if (match) return `${Number(match[3])}. ${Number(match[2])}. ${match[1]}.`
  return value ? String(value) : '—'
}

/** An ISO timestamp in local time: 9. 10. 2026. u 14:32 */
export const formatDateTime = (iso: string) => {
  const date = new Date(iso)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${date.getDate()}. ${date.getMonth() + 1}. ${date.getFullYear()}. u ${hours}:${minutes}`
}

/** An ISO timestamp in local time, sortable: 2026-10-09 14:32 */
export const toLocalDateTime = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * A date as the accountant types it, "11.1.2022." or "11. 1. 2022", to YYYY-MM-DD. YYYY-MM-DD is
 * accepted too. Null if it isn't a real date (yet: it's called while typing).
 */
export const parseDate = (text: string): string | null => {
  const trimmed = text.trim()
  if (isIsoDate(trimmed)) return trimmed
  const match = /^(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})\s*\.?$/.exec(trimmed)
  if (!match) return null
  const iso = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
  return isIsoDate(iso) ? iso : null
}

/** A stored date as it's shown in the input: 2022-01-11 → 11. 1. 2022., anything else as is. */
export const dateInputText = (value: string | null) =>
  value === null ? '' : isIsoDate(value) ? formatDate(value) : value
