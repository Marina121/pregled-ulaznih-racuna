// A company's tax ID (JIB) in BiH has 13 digits:
//   4 | 8 digits for the company | 3 digits for the business unit (000 = HQ) | check digit
// The VAT number has 12 digits: the HQ tax ID without the leading 4. So a branch has its own
// tax ID but the company's VAT number (e.g. inv-021 and inv-025), and that is not an error.

const WEIGHTS = [7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2]

const clean = (text: string) => text.replace(/\s/g, '')

/** Check digit: weighted sum of the first 12 digits, mod 11. */
export function isValidTaxId(raw: string): boolean {
  const digits = clean(raw)
  if (!/^\d{13}$/.test(digits)) return false
  const remainder =
    WEIGHTS.reduce((sum, weight, index) => sum + weight * Number(digits[index]), 0) % 11
  return (remainder <= 1 ? 0 : 11 - remainder) === Number(digits[12])
}

export function isValidVatId(raw: string): boolean {
  const digits = clean(raw)
  return /^\d{12}$/.test(digits) && isValidTaxId('4' + digits)
}

/** Same "company" part in both numbers, regardless of the business unit. */
export function sameCompany(taxId: string, vatId: string): boolean {
  return clean(taxId).slice(1, 9) === clean(vatId).slice(0, 8)
}

export function isBranch(taxId: string): boolean {
  return isValidTaxId(taxId) && clean(taxId).slice(9, 12) !== '000'
}
