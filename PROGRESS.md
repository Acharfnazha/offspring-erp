# OFFSPRING ERP — Progress

_Last updated: 2026-11-04 (end of build session)._

## Status summary

The application builds (`next build`), type-checks under strict mode, and passes **45 unit + integration tests** against PostgreSQL. A Playwright end-to-end suite covers the success criteria; see "Verification" for the latest run. Every screen reads and writes persistent records. Every visible control calls a real server action or route.

## Implemented modules

| Module | State | Notes |
|---|---|---|
| Foundation | ✅ | Next.js 15 App Router, TS strict, Tailwind, shadcn-style components on Radix, Lucide, Recharts, RHF + Zod, TanStack Table, Prisma 6 / PostgreSQL 16 |
| Database | ✅ | Normalized schema (≈45 models), 2 migrations: tables, then append-only triggers and CHECK constraints. Seed with fictional data |
| Auth & security | ✅ | bcrypt, DB sessions (hashed tokens, httpOnly cookie, sliding 12 h), lockout, password reset (single-use tokens), RBAC with 8 roles and 32 permissions enforced server-side, audit log, security headers |
| Layout & design | ✅ | Collapsible sidebar (17 items, permission-filtered), mobile drawer, top bar (global search, notifications, language EN/AR with RTL, theme light/dark/system, user menu, quick create), skeletons, empty states, toasts, confirmation dialogs, error boundary |
| Executive dashboard | ✅ | 10 KPIs with period comparison, 6 charts, range filters (today, 7 d, 30 d, month, year, custom), alerts, activity feed; all from DB queries |
| Inventory | ✅ | Receive, edit, transfer/split, reserve/release, spoilage, dispatch, adjust, movement ledger (DB-immutable), FIFO aging + FEFO suggestions, filters, sorting, pagination, CSV/XLSX export, documents per batch |
| Cold storage | ✅ | Rooms CRUD, manual readings + alerts, occupancy (own + customer goods), contracts with staged IN/OUT, billing engine, incremental invoice generation, audited adjustments, close contract, billing calculator, IoT ingest endpoint (disabled by default) |
| Customers / CRM | ✅ | CRUD + archive, Kanban pipeline (drag and drop) + table, follow-up reminders, detail with all related records, PDF statement |
| Suppliers & purchasing | ✅ | CRUD + archive, purchase orders, validated goods receipt (creates batches + supplier bill), PO cancel, balances, PDF statement |
| Sales orders | ✅ | Draft, confirm (FEFO/FIFO reservations), authorized override with reason, partial/full dispatch (to shipment), cancel (releases), pro forma and sales invoice, history, COGS and gross profit per order |
| Shipments | ✅ | CRUD, ISO 6346 container check, costs, status timeline, link orders, loaded goods, documents. Tracking interface only, no fabricated data |
| Quotations | ✅ | Builder, revisions (immutable snapshots), PDF preview and download, status changes, conversion to order, creation from profit calculation |
| Invoices | ✅ | 5 types, 6 statuses, manual invoices with tax and discounts, from orders and storage contracts, issue, cancel, credit notes, PDF |
| Payments | ✅ | In/out, 3 methods, partial, advance (on account), multi-invoice allocation, later allocation, void, receipt PDF, idempotency key + reference duplicate check, serializable transactions |
| Expenses | ✅ | 14 categories, approval workflow with segregation of duties, receipts, filters, monthly/yearly charts, export |
| Profit calculator | ✅ | All requested inputs and outputs, packaging items (grape defaults), currency conversion, margin vs markup, break-even and target price, 3 editable scenarios, sensitivity chart, save, convert to quotation |
| Analytics | ✅ | P&L, profit by product, customer and country, receivables aging, inventory turnover, occupancy, storage revenue, shipment performance, expenses by category, CSV/XLSX exports |
| AI assistant | ✅ | Provider abstraction: offline demo mode (no key needed), plus Anthropic Claude via the official SDK (`claude-opus-5-5`, server-side refusal fallback). Read-only, permission-scoped, rate-limited, audited |
| Documents | ✅ | Upload with type, signature and size validation, categories, links to 6 entity types, access levels, search, preview, download, archive |
| Employees | ✅ | Create (one-time password link), edit role, deactivate/reactivate (revokes sessions), reset link, permission matrix |
| Settings | ✅ | Company profile, storage billing policy, exchange rates, packaging defaults, allocation strategy, profile (password change, sessions), audit log viewer |
| Ops | ✅ | Dockerfile (standalone, non-root, health check), docker-compose (db + app + seed profile), GitHub Actions CI, `.env.example`, README, `docs/OPERATIONS.md` (deploy, backup, restore), `scripts/create-admin.ts` |

## Verification (actually run in this session)

- `npx tsc --noEmit`: passes.
- `next build` (including ESLint): passes.
- `npm test`: **45/45 passing** (28 unit, 17 integration on a real PostgreSQL test database).
- Playwright e2e: see the latest result below.

## Partially implemented / known gaps

- **Arabic localization**: the shell (navigation, top bar, login, groups) is translated with full RTL layout; module page bodies and PDFs are English only. The standard PDF fonts cannot render Arabic.
- **Email delivery**: not integrated. Reset links go to the server log or are generated by admins. Buyer email/WhatsApp drafts are copy-paste.
- **Draft order editing**: the service supports it (`updateDraftOrder`), but there is no edit page yet. Workaround: cancel and recreate the draft.
- **Role/permission editing in the UI**: the permission matrix is code-defined (`src/lib/auth/permissions.ts`) and mirrored into the `Permission`/`RolePermission` tables. Editing it in the UI is not implemented.
- **Multi-currency reporting**: amounts are converted with each document's stored rate; there is no historical FX table.
- **Inventory images**: photos can be attached as documents per batch; there is no inline gallery.
- **Batch/lot traceability report** (supplier → batch → order → shipment) is visible across pages but has no dedicated report.
- **External integrations** (carrier tracking, IoT sensors) are defined interfaces with no live providers.

## Next actions (suggested)

1. Add SMTP for password resets and invoice/quotation emailing.
2. Extend Arabic translations to module pages; embed an Arabic-capable font for PDFs.
3. Add the draft-order edit page and an inline batch photo gallery.
4. Historical exchange-rate table and FX gain/loss reporting.
5. Configure a production environment (TLS proxy, backups) per `docs/OPERATIONS.md`.

## Checkpoints (git history)

`git log --oneline` shows each phase commit: foundation → core modules → finance/logistics → advanced modules → tests/fixes → ops/docs.
