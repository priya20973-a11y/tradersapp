This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Trading module

The vertical Sales menu includes trader profiles, commodity masters (extensions of existing inventory items), commodity deals, warehouses, stock lots, trader ledger/payments, reports, and the trading audit log. Organization users are scoped to their own organization; the admin selects an organization before managing its trading data.

Sales customers have a searchable directory and a dedicated creation page with customer type, contact details, tax identifiers, opening balance, payment terms, addresses, reporting tags, and remarks. Customer portal access and document uploads are not configured.

New organization signups remain pending until approved from **Admin Organizations**. Administrators can view active and inactive organizations, activate/deactivate access, and reset an organization's owner password. Password resets generate a one-time temporary password and revoke the owner's existing sessions. Organization deletion requires two confirmations and transactionally removes the organization's accounts and records; this requires a replica-set MongoDB deployment.

Set `BANK_DETAILS_ENCRYPTION_KEY` in `.env.local` and in every deployment environment before adding trader bank details. Generate a key with:

```bash
openssl rand -base64 32
```

Store the result as a secret; do not commit it. The API refuses bank-detail writes if the key is missing or invalid. Bank account numbers are encrypted with AES-256-GCM and are never returned in plaintext.

Stock movement, payment allocation, deal settlement, and linked trader/customer/vendor updates use MongoDB transactions. Use MongoDB Atlas or a replica-set deployment; standalone MongoDB deployments cannot safely run these workflows. Stock movements are idempotent, organization-scoped, audited, and reject negative available stock.

Trader imports accept CSV or Excel files with a header row (up to 100 rows per import). Recognized columns include Trader Code, Legal Business Name, Trade Name, Business Type, Roles, Commodities, GSTIN, PAN, Contact Name, Mobile, Email, City, State, Credit Limit, Credit Period Days, Opening Receivable, and Opening Payable. Each row is validated by the same API as manual entry; failures are reported by source row.

The current ledger and reports are operational summaries over trader opening balances, sales invoices/credits/receipts, deals, stock lots, and trading payments. They do **not** post double-entry journal entries. Supplier payments can be recorded as advances, but purchase bills and bill allocation are not implemented. Secure document upload/storage is also not configured; do not collect KYC documents until a persistent private storage provider and access policy are selected.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
