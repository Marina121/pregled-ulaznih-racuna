// Bank accounts in BiH have 16 digits: 3 for the bank, 11 for the account, 2 check digits.
// The check digits are computed from the first 14 (mod 97), so a missing or misread digit can
// almost always be detected without looking at the original.

// Bank codes (first three digits). Most were verified on the original invoices in the dataset;
// 134, 141 and 154 come from EDO-SLAD (inv-003), which has no original, and were added from the
// public list of BiH banks. Unknown codes show only the number.
const BANKS: Record<string, string> = {
  '132': 'NLB Banka',
  '134': 'ASA Banka',
  '140': 'Sberbank BH',
  '141': 'Bosna Bank International',
  '154': 'Intesa Sanpaolo Banka',
  '161': 'Raiffeisen Bank',
  '194': 'ProCredit Bank',
  '199': 'Sparkasse Bank',
  '306': 'Addiko Bank',
  '338': 'UniCredit Bank',
  '555': 'Nova banka',
  '567': 'Sberbank Banja Luka',
  '571': 'Komercijalna banka',
}

const clean = (text: string) => text.replace(/[\s-]/g, '').toUpperCase()

/** An IBAN (BA39…) contains the domestic account number, so the bank is read from it. */
const domestic = (account: string) => (account.startsWith('BA') ? account.slice(4) : account)

function mod97(digits: string): number {
  // The number is too long for Number, so the remainder is computed digit by digit.
  return [...digits].reduce((remainder, digit) => (remainder * 10 + Number(digit)) % 97, 0)
}

export function isValidAccount(raw: string): boolean {
  const account = clean(raw)
  if (/^BA\d{18}$/.test(account)) {
    // Standard IBAN check: move the first four characters to the end, letters to digits (B=11,
    // A=10).
    return mod97(account.slice(4) + '1110' + account.slice(2, 4)) === 1
  }
  if (!/^\d{16}$/.test(account)) return false
  return 98 - mod97(account.slice(0, 14) + '00') === Number(account.slice(14))
}

export function bankName(raw: string): string | null {
  return BANKS[domestic(clean(raw)).slice(0, 3)] ?? null
}

/** 1610200055610004 → 161-020-00556100-04, as printed on invoices. */
export function formatAccount(raw: string): string {
  const account = clean(raw)
  if (/^\d{16}$/.test(account))
    return `${account.slice(0, 3)}-${account.slice(3, 6)}-${account.slice(6, 14)}-${account.slice(14)}`
  if (/^BA\d{18}$/.test(account)) return account.replace(/(.{4})/g, '$1 ').trim()
  return raw
}
