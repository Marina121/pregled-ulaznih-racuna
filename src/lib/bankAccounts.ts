// Bank accounts in BiH have 16 digits: 3 for the bank, 11 for the account, 2 check digits.
// The check digits are computed from the first 14 (mod 97), so a missing or misread digit can
// almost always be detected without looking at the original.

// Only banks whose name and code were verified on the original invoices in the dataset.
// For the others, only the number is shown.
const BANKS: Record<string, string> = {
  '132': 'NLB Banka',
  '140': 'Sberbank BH',
  '161': 'Raiffeisen Bank',
  '194': 'ProCredit Bank',
  '199': 'Sparkasse Bank',
  '306': 'Addiko Bank',
  '338': 'UniCredit Bank',
  '555': 'Nova banka',
  '567': 'Sberbank Banja Luka',
  '571': 'Komercijalna banka',
  '141': 'Bosna Bank International d.d. Sarajevo',
  '134':' ASA Banka d.d. Sarajevo',
  '154':' Intesa Sanpolo Banka DD BIH'

}

const clean = (s: string) => s.replace(/[\s-]/g, '').toUpperCase()

/** An IBAN (BA39…) contains the domestic account number, so the bank is read from it. */
const domestic = (c: string) => (c.startsWith('BA') ? c.slice(4) : c)

function mod97(digits: string): number {
  // The number is too long for Number, so the remainder is computed digit by digit.
  return [...digits].reduce((r, d) => (r * 10 + Number(d)) % 97, 0)
}

export function isValidAccount(raw: string): boolean {
  const c = clean(raw)
  if (/^BA\d{18}$/.test(c)) {
    // Standard IBAN check: move the first four characters to the end, letters to digits (B=11,
    // A=10).
    return mod97(c.slice(4) + '1110' + c.slice(2, 4)) === 1
  }
  if (!/^\d{16}$/.test(c)) return false
  return 98 - mod97(c.slice(0, 14) + '00') === Number(c.slice(14))
}

export function bankName(raw: string): string | null {
  return BANKS[domestic(clean(raw)).slice(0, 3)] ?? null
}

/** 1610200055610004 → 161-020-00556100-04, as printed on invoices. */
export function formatAccount(raw: string): string {
  const c = clean(raw)
  if (/^\d{16}$/.test(c))
    return `${c.slice(0, 3)}-${c.slice(3, 6)}-${c.slice(6, 14)}-${c.slice(14)}`
  if (/^BA\d{18}$/.test(c)) return c.replace(/(.{4})/g, '$1 ').trim()
  return raw
}
