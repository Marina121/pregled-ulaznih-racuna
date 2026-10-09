// Settings someone might want to change: thresholds, accepted values, timings. Constants that are
// part of a single piece of logic (bank codes, check digit weights, CSV columns) stay next to it.

/** Below this read confidence a field is flagged for checking (0.8 = 80 %). */
export const LOW_CONFIDENCE = 0.8

/** Amounts within 2 fenings count as equal: invoices round differently. */
export const AMOUNT_TOLERANCE = 0.02

/** For duplicates the amounts must match to the fening. */
export const SAME_AMOUNT_TOLERANCE = 0.005

/** Currencies the booking system accepts. Invoices in BiH often print "KM" for BAM. */
export const CURRENCIES = [
  { value: 'BAM', label: 'BAM (KM)' },
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
]

/** Change the version if the shape of the saved review state changes. */
export const STORAGE_KEY = 'racuni-pregled-v1'

/** Zoom of the original, in % of the frame width. Phone photos have small print. */
export const MIN_ZOOM = 100
export const MAX_ZOOM = 400
export const ZOOM_STEP = 50

/** "Poništi izmjene": how long "Vrati" stays, to undo it. */
export const UNDO_RESET_MS = 8000
