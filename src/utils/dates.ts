// General date helpers. Dates in the data are text in YYYY-MM-DD form.

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
