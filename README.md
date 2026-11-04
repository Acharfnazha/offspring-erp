# OFFSPRING ERP

Enterprise resource planning for **Offspring Group S.A.R.L.** (Lebanon): fresh-fruit export, agricultural trading, refrigerated storage and international logistics.

Inventory batches, cold rooms, CRM, purchasing, quotations, sales orders, container shipments, invoicing, payments, expenses, profit calculation, analytics, documents and an AI assistant all run in one Next.js application on PostgreSQL. Every figure in the app is computed from database records.

> **Sample data notice.** The seed script creates **fictional** companies, people and transactions for demonstration. They are not real Offspring Group records.

---

## Contents
1. [Quick start (local)](#1-quick-start-local)
2. [Quick start (Docker)](#2-quick-start-docker)
3. [Demo accounts & roles](#3-demo-accounts--roles)
4. [Modules](#4-modules)
5. [Architecture](#5-architecture)
6. [Business rules](#6-business-rules)
7. [Security](#7-security)
8. [Testing](#8-testing)
9. [Configuration](#9-configuration)
10. [Deployment, backup & restore](#10-deployment-backup--restore)
11. [Known limitations](#11-known-limitations)

---

## 1. Quick start (local)

Prerequisites: **Node.js 22+**, **PostgreSQL 16** (or Docker for the database only).

```bash
npm install
```

```bash
cp .env.example .env
```

Edit `DATABASE_URL` in `.env` if your PostgreSQL credentials differ. To create the role and databases on a local PostgreSQL:

```bash
sudo -u postgres psql -c "CREATE USER offspring WITH PASSWORD 'offspring' CREATEDB;" -c "CREATE DATABASE offspring_erp OWNER offspring;" -c "CREATE DATABASE offspring_erp_test OWNER offspring;"
```

Apply the migrations:

```bash
npm run db:migrate
```

Load the fictional demo data (this **wipes** the target database first):

```bash
npm run db:seed
```

Start the development server at http://localhost:3000:

```bash
npm run dev
```

Production build and start:

```bash
npm run build
```

```bash
npm run start
```

> `next.config.mjs` uses `output: "standalone"`. `npm run start` works for local checks; in production run `node .next/standalone/server.js` (see the Dockerfile), after copying `.next/static` and `public` next to it.

## 2. Quick start (Docker)

```bash
cp .env.example .env
```

Set a strong `POSTGRES_PASSWORD` in `.env`, then build and start the database and app. Migrations are applied automatically when the app container starts.

```bash
docker compose up -d --build
```

Optional, loads the fictional demo data (wipes the database):

```bash
docker compose --profile seed run --rm seed
```

## 3. Demo accounts & roles

All seeded accounts use the password **`Offspring!2026`**. Change them, or deactivate them, before any real use.

| Email | Role | Typical access |
|---|---|---|
| admin@offspring.example | Super Admin | Everything |
| it@offspring.example | Administrator | Everything except granting Super Admin |
| accounts@offspring.example | Accountant | Finance, expenses (approve), storage billing, financial analytics, audit log |
| warehouse@offspring.example | Warehouse Manager | Inventory, cold storage, purchasing & receiving |
| sales@offspring.example | Sales Manager | CRM, quotations, orders (incl. inventory override), receivables (read) |
| logistics@offspring.example | Logistics Manager | Shipments, documents, expense submission |
| staff@offspring.example | Employee | Read core operations, submit expenses |
| viewer@offspring.example | Read-Only Viewer | Read operational modules, no financial data |

The full permission matrix is under **Employees** in the app, and in `src/lib/auth/permissions.ts`.

## 4. Modules

| Module | What it does |
|---|---|
| **Overview** | KPI cards (revenue, net profit, receivables, payables, stock weight/value, cold-room occupancy, active shipments, pending quotations, orders awaiting payment) with period comparison; revenue/expense/profit, sales by country/product, collections, inventory and room utilization charts; alerts (overdue invoices, expiring stock, temperature exceptions); audit-based activity feed. Filters: today, 7 days, 30 days, this month, this year, custom. |
| **Inventory** | Batches with variety, grade (Extra / Class I / Class II / Custom), origin, supplier, harvest/arrival/best-before dates, kg, cartons, packaging, cost/kg, location and status. Receive, edit, transfer (partial transfers split the batch), reserve and release, spoilage, dispatch, count adjustment, append-only movement history, FIFO aging with FEFO pick suggestions, CSV/XLSX export. Negative stock and overselling are blocked inside database transactions with row locks. |
| **Cold Storage** | Rooms with capacity, occupancy (own stock plus customer goods), target and recorded temperature/humidity, status and maintenance notes. Manual reading log with out-of-range alerts; an IoT ingestion endpoint is prepared but disabled by default. Third-party storage contracts with staged entries and removals, a billing breakdown, invoice generation and audited manual adjustments. |
| **Customers** | International CRM: company, country, contacts, WhatsApp, currency, payment terms, type, credit limit and notes; 10-stage pipeline as a Kanban board (drag and drop) and a table; follow-up reminders; detail page with orders, quotations, invoices, payments, shipments and storage contracts; PDF account statement. |
| **Suppliers** | Supplier records, purchase history, outstanding balances, quality notes. Purchase orders, then goods receipts: inventory is created only by a validated receipt transaction, which optionally creates the supplier bill. |
| **Sales & Orders** | Draft, then confirmed (FEFO/FIFO reservations), then partial or full dispatch, then invoiced. Incoterms (FOB, CFR, CIF, …), discounts, payment and delivery terms, cancellation (releases reservations), order history. Confirming beyond available stock requires the `sales:override` permission and a reason, which is recorded. |
| **Shipments** | Container, air or road shipments with lines, forwarders, ports, ETD/ATD/ETA/ATA, weights, cartons and freight/insurance/documentation/customs costs. Status timeline and shipping-document attachments. External tracking is an interface only; no tracking data is fabricated. |
| **Quotations** | Branded PDF quotations with automatic numbering, revision history (immutable snapshots), in-page preview, sent/accepted/rejected status, and conversion to a sales order. |
| **Invoices** | Sales, purchase, cold-storage, pro forma and credit notes. Statuses: Draft, Issued, Partially paid, Paid, Overdue, Cancelled. PDF download. Credit notes are applied to the original invoice. |
| **Payments** | Incoming and outgoing; bank transfer, cash or other. Partial payments, advances held on account, allocation to several invoices, voiding (balances are restored), receipt and voucher PDFs. An idempotency key and a reference check prevent double posting. |
| **Expenses** | 14 categories, approval workflow (pending, approved/rejected, paid; you cannot approve your own expense), receipt attachments, monthly and yearly charts, filters, export. |
| **Profit Calculator** | Purchase, packaging (per-carton items such as grape sheet, carton and pad), labor, sorting, refrigeration and logistics costs. Outputs landed cost, cost per kg and per carton, gross margin **vs** markup, break-even and target price, currency conversion, best/expected/worst scenarios and a sensitivity chart. Calculations can be saved and converted into a quotation. |
| **Analytics** | P&L, profit by product, customer and destination country, receivables aging, inventory turnover, warehouse occupancy, cold-storage revenue, shipment performance, expenses by category. CSV/XLSX exports. |
| **AI Assistant** | Read-only, permission-scoped business Q&A, buyer email, WhatsApp and quotation drafts, profit estimates and scenario comparisons. Works **offline in demo mode** without any API key; optionally uses Anthropic Claude. |
| **Documents** | Upload (type and signature validated, size-limited, stored outside the web root), categories, links to customer, shipment, invoice, expense, batch or supplier, search, preview, download, and access levels (all staff / finance / management). |
| **Employees** | User management, least-privilege roles, deactivation (signs the user out of all sessions), one-time password-reset links, permission matrix. |
| **Settings** | Company profile (printed on PDFs), storage billing policy, exchange rates, packaging defaults, FEFO/FIFO strategy, personal profile, password change, session list, audit log. |

The top bar has global search, notifications, a quick-create menu, an English/Arabic switcher with RTL layout, light/dark/system themes and the user menu.

## 5. Architecture

A modular monolith in one Next.js 15 App Router application with TypeScript strict mode.

```
src/
  app/(app)/<module>/        pages (server components) + actions.ts (server actions)
  app/api/                   health, exports (CSV/XLSX), PDFs, document download, IoT ingest
  components/                design system (shadcn-style on Radix), data table (TanStack), charts (Recharts), forms (RHF + Zod)
  lib/services/              domain logic, transactional: inventory, orders, finance, storage, quotations, analytics, notifications
  lib/                       money (decimal.js), dates, storage-billing engine, profit engine, invoice math, auth, i18n, PDF
prisma/                      schema, migrations (incl. append-only triggers), seed
tests/unit | integration | e2e
```

- **Data**: PostgreSQL through Prisma 6. Money is stored as `Decimal(18,2)`, prices and rates as `Decimal(18,4)`, weights as `Decimal(14,3)`. All arithmetic uses `decimal.js`; there is no floating-point money math.
- **Transactions**: every inventory, order, invoice, payment and storage operation runs inside a Prisma transaction, with `SELECT … FOR UPDATE` row locks on the batch, order, invoice or payment involved. Payments run at `Serializable` isolation.
- **Ledgers**: `InventoryMovement` and `AuditLog` are append-only; a PostgreSQL trigger rejects `UPDATE` and `DELETE`. CHECK constraints enforce non-negative stock, `reserved ≤ on hand`, positive payments and `paid ≤ total`.
- **Validation**: Zod schemas in `src/lib/schemas.ts` are shared by client forms and server actions. The server parse is authoritative.
- **Numbering**: atomic counters (`INSERT … ON CONFLICT … RETURNING`) produce `SO-2026-00001`, `INV-…`, `QT-…`, `LOT-…` and so on.
- **Reporting model** (used by the dashboard, analytics and assistant alike): revenue = issued sales + storage invoices − credit notes (converted to USD at the document rate); COGS = dispatched kg × batch cost; net profit = gross profit − shipment logistics − approved operating expenses. Fruit-purchase expenses are excluded from net profit because COGS already counts them. This is an operational view, not a certified accounting package.

## 6. Business rules

**Cold-storage billing** (`src/lib/storage-billing.ts`): the default is **$0.05 per kg per billing month**, configurable globally and per contract.
- Billing periods are consecutive calendar months anchored to the entry date (Jan 31 → Feb 28/29 → Mar 31 …). A started period counts as a full period.
- 10,000 kg for exactly 1 month costs **$500**; for 1 month and 1 day, **$1,000**; for 15 days, **$500**.
- Same-day entry and exit is charged the contract's minimum (default 1 month; configurable down to 0).
- Staged removals are matched to the oldest entries first (FIFO), and each quantity is billed for its own storage period.
- Dates are calendar dates in the business time zone (`BUSINESS_TIMEZONE`, default Asia/Beirut), so server and browser time zones cannot shift a bill.
- Invoicing is incremental: each storage invoice bills cumulative charges minus amounts already invoiced, plus pending manual adjustments.

**Inventory**: FEFO allocation (earliest best-before first, then oldest arrival) or FIFO, set under Settings. Quarantined batches cannot be reserved. A partial transfer creates a child batch (`LOT-2026-0001-S1`).

**Orders**: confirming an order reserves stock. A shortfall needs an override permission and a reason. Dispatch consumes the order's reservations first, then unreserved stock, and can never exceed outstanding quantity. An order with dispatched goods cannot be cancelled; issue a credit note instead.

**Incoterms**: freight and insurance are never assumed. Quotation PDFs state what the chosen Incoterm includes and excludes.

## 7. Security

- Passwords are hashed with bcrypt (cost 12) and must meet a strength policy. An account locks for 15 minutes after 5 failed logins. Login errors are generic and timing-equalized.
- Sessions are stored in the database as SHA-256 hashes of random tokens, sent as an `httpOnly` `SameSite=Lax` cookie (`Secure` when `COOKIE_SECURE=true`) with a 12-hour sliding expiry. Deactivating a user or changing their role revokes their sessions.
- Password reset uses single-use, 1-hour tokens. Responses never reveal whether an account exists. Without an email service, the link is written to the server log, or an admin generates it in Employees.
- Authorization is checked server-side in every page (`requireUser(permission)`), server action (`assertPermission`), export, PDF, document download and assistant query. Middleware only redirects unauthenticated requests. Financial KPIs are hidden from roles without `analytics:finance`.
- Uploads are checked against an extension allow-list and file signature, limited in size, stored with random names outside `public/`, and served with `nosniff`, a sandboxing CSP and `no-store`.
- Every create, update, financial action, export, login and document download is written to the audit log.
- CSV and XLSX exports neutralize spreadsheet formula injection.
- Security headers: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. Server actions get the built-in Next.js origin check.
- No secrets are committed. `.env` is git-ignored and `.env.example` documents every variable.

**AI assistant safeguards**: the assistant has **no write tools**. Suggested changes appear as links the user must open and confirm in the normal forms. Context is gathered per question by permission-checked queries and carries only aggregates and the minimum fields needed (no contact details or credentials). The Anthropic key comes only from the environment. Each user is rate-limited, and every question is audited (intent only, not the content).

## 8. Testing

Unit and integration tests (Vitest). Integration tests run against `TEST_DATABASE_URL`, which is migrated automatically and truncated between tests:

```bash
npm test
```

End-to-end tests (Playwright) need a production build and a seeded database:

```bash
npm run build
```

```bash
npm run db:seed
```

```bash
npx playwright install chromium
```

```bash
npm run test:e2e
```

If a compatible Chromium is already installed, point the tests at it with `PW_CHROMIUM_PATH=/path/to/chrome npm run test:e2e`.

| Suite | Covers |
|---|---|
| `tests/unit/storage-billing.test.ts` | $0.05 rule examples, month-end clamping, leap years, year boundaries, same-day, staged FIFO removals, configurable rate, time-zone date derivation |
| `tests/unit/profit.test.ts` | landed cost, margin vs markup, carton rounding, currency conversion, scenarios, sensitivity, validation |
| `tests/unit/money.test.ts` | decimal arithmetic, currency conversion, line discount and tax, header discount, balances, invoice status derivation |
| `tests/integration/inventory-orders.test.ts` | receiving, capacity limits, ledger immutability (DB trigger), reservation and release, negative-stock prevention, batch split, concurrent reservations, FEFO confirmation, partial/full fulfillment with COGS, authorized override, cancellation |
| `tests/integration/finance-storage.test.ts` | invoice from order (dispatched qty, discounts), invalid totals and dates, partial and full payment, over-allocation, wrong customer, duplicate prevention (idempotency key and reference), advance payments, void, credit notes, storage contract billing and incremental invoicing with adjustments |
| `tests/e2e/workflow.spec.ts` | login and route protection; create a Dubai customer, receive 20,000 kg of apples into a cold room, quotation with PDF, convert to order, confirm, shipment, dispatch, invoice with PDF, partial payment, analytics, exports; storage calculator; offline assistant and permission enforcement |

Lint and type check:

```bash
npm run lint
```

```bash
npm run typecheck
```

## 9. Configuration

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `TEST_DATABASE_URL` | Separate database for integration tests (truncated on every run!) |
| `APP_URL` | Public base URL, used in password-reset links |
| `COOKIE_SECURE` | `true` behind HTTPS |
| `UPLOAD_DIR`, `MAX_UPLOAD_MB` | Document storage location and size limit |
| `BUSINESS_TIMEZONE` | Calendar-date boundary for billing and reports (default `Asia/Beirut`) |
| `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT` | Optional AI provider. Leave empty for offline demo mode. Default model `claude-opus-5-5`; server-side refusal fallback is enabled. |
| `SENSOR_API_KEY` | Enables `POST /api/integrations/sensor-readings` for future IoT temperature sensors (Bearer auth) |

Business settings (company details printed on PDFs, storage rate, exchange rates, packaging defaults, FEFO/FIFO) are edited in the app under **Settings** and stored in the `Setting` table.

## 10. Deployment, backup & restore

See [`docs/OPERATIONS.md`](docs/OPERATIONS.md) for the deployment checklist, reverse proxy and TLS, migrations, backups (`pg_dump` plus the uploads volume), restore and upgrade steps. Do not expose PostgreSQL publicly, set `COOKIE_SECURE=true` behind HTTPS, rotate the demo passwords (or don't seed in production), and back up both the database **and** the uploads directory.

## 11. Known limitations

See [`PROGRESS.md`](PROGRESS.md) for the full list of implemented, partial and future work. In short:
- Emails are not sent: there is no SMTP integration. Reset links go to the server log or are generated by an admin.
- Arabic covers the navigation, shell and login with full RTL layout. Module pages and PDFs are English. PDFs use the standard PDF fonts, which cannot render Arabic glyphs.
- Exchange rates are maintained manually, and multi-currency documents are reported at their document rate.
- External shipment tracking and IoT sensors are prepared interfaces only.
- This is an operational system and not a substitute for jurisdiction-specific certified accounting software or legal review of trade documents.
