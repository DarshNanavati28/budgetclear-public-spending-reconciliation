# BudgetClear

BudgetClear is a browser-based public spending review tool for CSV and manually entered expenditure records. It checks line sums against reviewer-entered stated totals, flags exact duplicate patterns and missing fields, and keeps optional category and amount-review suggestions separate from verified arithmetic.

## Run locally

Requires Node.js 20 or newer.

```sh
npm install
npm run dev
```

Open the local address printed by Vite. `npm run build` creates the production site in `dist/`; `npm run preview` serves that build locally.

## Use

- Start with the demonstration review, or use **Review settings → Start a new review** before importing real data.
- Upload a CSV with a header row and columns such as `date`, `description`, `category`, `amount`, and `reference`. The importer also recognizes common aliases like `details`, `value`, `ref`, and `voucher`.
- Import replaces the active lines and clears stated totals. Enter the stated overall and category amounts in **Reconciliation**.
- Add or edit line items from **Transactions**. An empty category remains unassigned; nothing is inferred into the source data.
- Export the source lines as CSV or the evidence-linked findings as JSON. Print from **Reconciliation** for a printable review copy.
- Records are stored in the current browser's local storage. The app does not send budget records to a server.

## Checks and safeguards

- Money is parsed into integer paise for exact addition and comparison. If any amount is missing or unreadable, the full overall sum is marked pending instead of treating a partial sum as complete.
- Category totals are compared with lines carrying that category. A missing category remains visible as an unassigned line.
- Duplicate flags require matching date, description, category, amount, and reference. A duplicate flag is a review prompt; it does not remove or omit either line from the sum.
- Amount outliers are statistical review suggestions when a line is at least three times a category median and there are at least four comparable entries.
- Category suggestions are local keyword rules with confidence estimates. They are not AI-generated, are not applied automatically, and never affect totals or verified arithmetic checks.
- Every exported report separates verified arithmetic checks from review suggestions and includes the line numbers and explanation used as evidence.

**An anomaly flag is not proof of corruption or wrongdoing. Every flag needs human investigation before any conclusion is drawn.**

## Demonstration data

The first run uses a sample district operations review with an intentionally misstated overall total, a category total mismatch, one exact duplicate, one missing category, and a high Energy amount for review. Use `public/sample-spending.csv` to reload the same line items through the CSV importer.
