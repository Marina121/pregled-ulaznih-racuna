# CLAUDE.md

Interview task: an interface where an accountant reviews and confirms incoming invoices that a
system has already read automatically. The accountant handles ~40 small companies and several
hundred invoices a month. Every extracted field has a value and a confidence (0 to 1), and the
data is deliberately messy.

## Stack and commands

- React 19 + TypeScript + Vite, Mantine for UI components. No backend: data is
  `public/invoices.json`, originals are in `public/originals/`, review state is in localStorage.
- `npm run dev` starts the app, `npm run build` type-checks and builds, `npm run lint` runs oxlint.
  Build and lint must pass before every commit.

## Where things are

- `src/lib/checks.ts`: all automatic checks. Returns issues per invoice; each issue has a stable
  key so "checked" survives recomputation.
- `src/lib/bankAccounts.ts`, `src/lib/taxIds.ts`: BiH bank account (mod 97) and tax ID / VAT
  number (mod 11) validation.
- `src/lib/export.ts`: what was corrected on an invoice, and the CSV export of confirmed ones.
- `src/hooks/useReview.ts`: review state (pending / confirmed / rejected, edits, reviewed issues).
- `src/components/`: list, original viewer, fields panel.

`src/lib/` holds plain functions with no React, so they can be used anywhere. React hooks go in
`src/hooks/`, one per file, named after the hook.

## Conventions

- UI text is Croatian (the user is an accountant in BiH). Code comments and commit messages are
  English.
- Comments explain why, not what.
- Components: `export type Props = { ... }` and `export const Name: FC<Props> = ({ a, b }) => {`,
  with props destructured in the parameter. Local state must not reuse a prop's name.
- Small commits with clear messages. Never squash or rewrite pushed history.
- Don't add libraries without asking.
- The README is written by the developer in her own words. Don't write or rewrite it.

## Product decisions to keep

- Prefer something that can be computed (check digits, net + VAT = total, quantity x price) over
  the system's confidence score. Fewer false warnings: if there are too many, the accountant
  learns to click through them.
- Nothing is deleted. A duplicate is rejected, kept and reversible.
- No "are you sure?" dialogs. Everything can be undone instead, and confirmation is locked until
  every issue has been reviewed.
- A branch office has its own tax ID but the company's VAT number. That is not an error.
- Before changing a check, look at the original invoice images, not only the JSON.
