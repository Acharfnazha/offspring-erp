# OFFSPRING ERP — Progress

_Last updated: in progress (checkpoint 1)_

## Done
- Project foundation (Next.js 15 App Router, TS strict, Tailwind, Prisma 6, PostgreSQL)
- Full normalized schema + migrations (incl. append-only triggers for inventory movements & audit log, CHECK constraints)
- Domain services: inventory (receive/transfer/split/reserve/release/spoilage/dispatch/adjust, FEFO/FIFO), orders (confirm w/ reservations & override, partial dispatch, cancel), finance (invoices, credit notes, payments, allocations, idempotency), cold-storage billing engine
- Auth: bcrypt, DB sessions (hashed tokens, httpOnly cookie), lockout, password reset tokens, RBAC matrix
- Unit tests: storage billing, profit, money/invoice math (28 passing)
- Seed script with fictional sample data

## In progress
- UI modules

## Next
- Pages for every module, PDF, exports, integration + e2e tests, Docker, CI, README
