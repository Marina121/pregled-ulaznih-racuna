# CLAUDE.md

An interface where an accountant reviews and confirms incoming invoices that a
system has already read automatically. The accountant handles ~40 small companies and several
hundred invoices a month. Every extracted field has a value and a confidence (0 to 1), and the
data is deliberately messy.

## Stack and commands

- React 19 + TypeScript + Vite, Mantine for UI components. No backend: data is
  `public/invoices.json`, originals are in `public/originals/`, review state is in localStorage.
- `npm run dev` starts the app, `npm run build` type-checks and builds, `npm run lint` runs oxlint.
  Build and lint must pass before every commit.

## Where things are

- `src/lib/`: the business rules. Plain functions, no React.
  - `checks.ts`: all automatic checks. Returns issues per invoice; each issue has a stable key
    (including the values it is about) so "checked" survives recomputation.
  - `bankAccounts.ts`, `taxIds.ts`: BiH bank account (mod 97) and tax ID / VAT number (mod 11)
    validation.
  - `fields.ts`: the invoice fields shown for review, with labels and whether they're required.
  - `export.ts`: what was corrected on an invoice, and the CSV export of confirmed ones.
- `src/utils/`: general helpers that know nothing about invoices (`values.ts`, `dates.ts`). Reuse
  them instead of writing another local copy.
- `src/hooks/`: React hooks, one per file, named after the hook. `useReview.ts` holds the review
  state (pending / confirmed / rejected, edits, reviewed issues).
- `src/components/`: invoice list, original viewer, fields panel, one field row.
- `src/config.ts`: settings someone might change (confidence threshold, amount tolerance,
  currencies, zoom limits, storage key, timings). No unnamed numbers in the code: give them a name
  here, or next to the logic if they belong only to it (bank codes, check digit weights).

## Conventions

- UI text is Croatian (the user is an accountant in BiH). Code comments and commit messages are
  English.
- Comments explain why, not what, and only where the code would look wrong or get "simplified"
  back into a bug without them. Keep them to one line where possible.
- Components: `export type Props = { ... }` and `export const Name: FC<Props> = ({ a, b }) => {`,
  with props destructured in the parameter. Local state must not reuse a prop's name.
- Object shapes are declared with `type`, not `interface`.
- Inside a component, in this order: state (useState, custom hooks), derived values (useMemo,
  plain consts), functions, effects (useEffect, useHotkeys), early returns, JSX. All hooks stay
  above any early return. No section-marker comments.
- Small commits with clear messages. Never squash or rewrite pushed history.
- Don't add libraries without asking.

## Product decisions to keep

- Prefer something that can be computed (check digits, net + VAT = total, quantity x price) over
  the system's confidence score. Fewer false warnings: if there are too many, the accountant
  learns to click through them.
- A warning (yellow) can be marked "Provjereno". A reading error (red: date or currency format,
  check digit, bank account) must be corrected. A red issue where the invoice itself can be like
  that (missing field, doesn't add up, other buyer) needs an explicit "Takvo je na originalu",
  which is listed in the CSV export.
- Nothing is deleted. A duplicate is rejected, kept and reversible.
- No "are you sure?" dialogs. Everything can be undone instead, and confirmation is locked until
  every issue has been reviewed.
- A branch office has its own tax ID but the company's VAT number. That is not an error.
- Before changing a check, look at the original invoice images, not only the JSON.
