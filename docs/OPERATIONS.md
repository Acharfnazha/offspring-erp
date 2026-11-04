# OFFSPRING ERP — Operations guide

Deployment, migrations, backup/restore and upgrade procedures. **No production deployment has been performed**; this guide prepares one.

## 1. Pre-deployment checklist

- [ ] Server with Docker Engine + Compose plugin (or Node.js 22 + PostgreSQL 16 managed service).
- [ ] DNS name and TLS certificate; reverse proxy (Caddy, Nginx, Traefik) terminating HTTPS in front of port 3000.
- [ ] `.env` created from `.env.example` with: a strong `POSTGRES_PASSWORD`, `APP_URL=https://erp.your-domain`, `COOKIE_SECURE=true`.
- [ ] PostgreSQL **not** published to the internet (compose keeps it on the internal network by default).
- [ ] Decide on demo data: **do not run the seed in production** (it wipes the database). Create the first Super Admin as described in §4.
- [ ] Backups scheduled (§5) and a restore tested (§6).
- [ ] Optional: `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` (the assistant works offline without them).

## 2. Deploy with Docker Compose

```bash
docker compose up -d --build
```

The `app` container applies pending Prisma migrations at start-up (`docker/entrypoint.sh`; set `SKIP_MIGRATIONS=true` to manage them separately), then starts the standalone Next.js server as a non-root user. Health check: `GET /api/health` returns `{"status":"ok","db":"ok"}`.

Example Caddy reverse proxy (`Caddyfile`):

```
erp.example.com {
  reverse_proxy 127.0.0.1:3000
  header Strict-Transport-Security "max-age=31536000; includeSubDomains"
}
```

## 3. Deploy without Docker

```bash
npm ci
```

```bash
npx prisma migrate deploy
```

```bash
npm run build
```

Copy static assets next to the standalone server and start it (use a process manager such as systemd or pm2):

```bash
cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public
```

```bash
NODE_ENV=production PORT=3000 node .next/standalone/server.js
```

## 4. First administrator (production, without seed data)

Run once against the production database. It creates a Super Admin with a random unusable password and prints a one-time password-set link:

```bash
npx tsx scripts/create-admin.ts admin@your-domain.com "Full Name"
```

Open the printed link (valid 1 hour) to choose a password. Then configure company details, storage rate and exchange rates under **Settings**.

## 5. Backups

Two things must be backed up together: the **PostgreSQL database** and the **uploads directory/volume** (documents).

Database (compressed custom format):

```bash
docker compose exec -T db pg_dump -U offspring -d offspring_erp -Fc > backup-$(date +%F).dump
```

Uploads volume:

```bash
docker run --rm -v offspring-erp_uploads:/data -v "$PWD":/backup alpine tar czf /backup/uploads-$(date +%F).tgz -C /data .
```

Recommendations: nightly schedule (cron), keep 30 daily + 12 monthly copies, store off-site/encrypted, and test a restore monthly. The audit log and inventory movement ledger are append-only, so backups also preserve the full history.

## 6. Restore

Stop the app, restore the database into an empty database, restore the uploads, start the app.

```bash
docker compose stop app
```

```bash
docker compose exec -T db pg_restore -U offspring -d offspring_erp --clean --if-exists < backup-YYYY-MM-DD.dump
```

```bash
docker run --rm -v offspring-erp_uploads:/data -v "$PWD":/backup alpine sh -c "tar xzf /backup/uploads-YYYY-MM-DD.tgz -C /data"
```

```bash
docker compose start app
```

## 7. Upgrades & migrations

1. Back up (§5).
2. Pull the new version and rebuild: `docker compose up -d --build` (migrations apply automatically).
3. For development schema changes: edit `prisma/schema.prisma`, then `npx prisma migrate dev --name <change>` and commit the generated migration folder. Never edit an already-applied migration.

## 8. Monitoring & maintenance

- Health endpoint: `/api/health` (DB connectivity).
- Application errors are logged to stdout/stderr (`docker compose logs -f app`).
- Expired sessions are removed on access; to purge in bulk: `DELETE FROM "Session" WHERE "expiresAt" < now();`
- Password-reset links (when no email service is configured) appear in the app logs as `[password-reset]` — restrict log access accordingly.

## 9. Security notes

- Rotate any demo credentials; deactivate unused accounts (Employees → Deactivate signs them out immediately).
- Keep `ANTHROPIC_API_KEY`, `SENSOR_API_KEY` and database credentials only in the environment / secret store.
- The IoT sensor endpoint is disabled unless `SENSOR_API_KEY` is set; it accepts readings only for rooms with a matching `sensorId`.
