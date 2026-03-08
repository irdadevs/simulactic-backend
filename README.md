# Galactic API Backend

Backend API for procedural galaxy generation/simulation with authentication, ownership, donations, observability, caching, maintenance jobs, and a security ban system.

## Overview

- Base API prefix: `/api/v1`
- Runtime: Node.js + TypeScript + Express 5
- Data stores: PostgreSQL + Redis
- Auth transport: `Authorization: Bearer` or `httpOnly` cookies (`access_token`, `refresh_token`)
- Payment provider: Stripe

## API Response Strategy

The API now follows a resource-first response style for successful requests, and a consistent error envelope.

### Success responses

- Single aggregate reads usually return the aggregate object directly.
- List endpoints return:
  - `{ rows: [...], total: number }`
- Composite reads return named objects (example: galaxy population tree).
- Mutations that do not need a payload return `204 No Content`.
- Auth/user-oriented endpoints may return action payloads like:
  - `{ user: ... }`
  - `{ ok: true }` (token refresh)

### Error responses

Errors use:

```json
{ "ok": false, "error": "ERROR_CODE", "message": "..." }
```

Validation errors use:

```json
{ "ok": false, "error": "INVALID_BODY", "details": { "...": "..." } }
```

Common auth/authorization errors:

- `401`: `UNAUTHORIZED` or `INVALID_TOKEN`
- `403`: `FORBIDDEN`, `AUTH.USER_BANNED`, `AUTH.IP_BANNED`

The audit middleware also injects/returns `x-request-id` in every response.

### Dashboard view and sanitization

Some admin endpoints support `?view=dashboard` to return extended, sanitized payloads:

- Users: includes verification metadata, excludes secrets.
- Donations: exposes provider type and masked provider identifiers.
- Logs and metrics: includes additional admin context with sensitive values redacted/masked.

### Supporter badges and progress

Supporter progression is computed from persisted donations and exposed as a compact client payload:

- `totalDonatedEurMinor`: total donations converted to EUR minor units.
- `monthlySupportingMonths`: total elapsed monthly support time.
- `unlockedBadges`: badge ids (`amount_l*`, `months_l*`) for client-side rehydration.
- `amountBranch` / `monthlyBranch`: current level and next threshold.

EUR normalization now uses persisted daily FX rates (`billing.fx_rates_daily`) refreshed by maintenance jobs from ECB.

Badge branches:

- Amount (EUR): `5, 20, 50, 100, 250, 500` EUR.
- Monthly support: `1, 3, 6, 12, 24, 36` months.

## Security Ban System

Security bans are implemented at both user and IP level.

### Manual admin bans

- User ban/unban endpoints:
  - `POST /api/v1/users/:id/ban`
  - `POST /api/v1/users/:id/unban`
- IP ban/unban endpoints:
  - `POST /api/v1/users/bans/ip`
  - `POST /api/v1/users/bans/ip/unban`
- Active bans listing:
  - `GET /api/v1/users/bans?limit=...`

Ban records include `reason`, `source` (`admin` or `system`), `bannedBy`, `createdAt`, and optional `expiresAt`.

### Automatic protection

The request audit pipeline reports suspicious signals to `SecurityBanService`.

- Auto-ban strike window: `10 minutes`
- Threshold: `30 points`
- Auto-ban duration: `1 hour`
- Point strategy:
  - failed login (`POST /users/login` with 400): `+2`
  - `429`: `+3`
  - `401`/`403`: `+1`

When an IP is auto-banned, it is stored as a `system` ban and blocked by `SecurityGuardMiddleware`.

### Enforcement points

- IP checks:
  - at global security guard middleware (`403 AUTH.IP_BANNED`)
  - before login flow (service-level assertion)
- User checks:
  - in auth middleware per authenticated request (`403 AUTH.USER_BANNED`)
  - during login flow
- User bans revoke all active sessions for that user and invalidate user cache snapshots.

## Authorization Rules

- Any authenticated user can create galaxies.
- Non-admin users can only access/mutate their own galaxy tree resources.
- Admin users can access all resources.
- Non-supporter users are capped at 3 stored galaxies.
- Supporters/admins can create unlimited galaxies.

## Health Endpoints

These are not under `/api/v1`:

- `GET /healthz`
- `GET /readyz`

## API Endpoints

All endpoints below are prefixed by `/api/v1`.

### Users

- `GET /users/health` (Auth + Admin)
- `POST /users/login` (public)
- `POST /users/token/refresh` (public)
- `POST /users/logout` (Auth)
- `POST /users/logout/all` (Auth)
- `POST /users/signup` (public)
- `POST /users/verify` (public)
- `POST /users/verify/resend` (public)
- `GET /users/me` (Auth)
- `GET /users/me/supporter-progress` (Auth)
- `PATCH /users/me/email` (Auth)
- `PATCH /users/me/password` (Auth)
- `PATCH /users/me/username` (Auth)
- `DELETE /users/me` (Auth)
- `GET /users` (Auth + Admin)
- `GET /users/email/:email` (Auth + Admin)
- `GET /users/username/:username` (Auth + Admin)
- `GET /users/:id` (Auth + Admin)
- `PATCH /users/:id/role` (Auth + Admin)
- `DELETE /users/soft-delete` (Auth + Admin)
- `POST /users/restore` (Auth + Admin)
- `GET /users/bans` (Auth + Admin)
- `POST /users/bans/ip` (Auth + Admin)
- `POST /users/bans/ip/unban` (Auth + Admin)
- `POST /users/:id/ban` (Auth + Admin)
- `POST /users/:id/unban` (Auth + Admin)

Password change contract:

- `PATCH /users/me/password` requires body:
  - `{ "currentPassword": "string(min:6)", "newPassword": "string(min:6)" }`
- If `currentPassword` is wrong, API returns `400` with `AUTH.INVALID_CREDENTIALS`.
- On success, password is updated and all user sessions are revoked.

### Galaxies

- `POST /galaxies` (Auth)
- `GET /galaxies` (Auth)
- `GET /galaxies/owner/:ownerId` (Auth)
- `GET /galaxies/name/:name` (Auth)
- `GET /galaxies/counts/global` (Auth + Admin)
- `GET /galaxies/:id/populate` (Auth)
- `GET /galaxies/:id/counts` (Auth)
- `GET /galaxies/:id` (Auth)
- `PATCH /galaxies/:id/name` (Auth)
- `PATCH /galaxies/:id/shape` (Auth)
- `DELETE /galaxies/:id` (Auth)

Galaxy read model notes:

- `GET /galaxies/:id/populate` returns the full galaxy tree (`galaxy` + all `systems`, `stars`, `planets`, `moons`, `asteroids`) without truncation.
- `GET /galaxies/:id/counts` returns per-galaxy aggregate counts: `systems`, `stars`, `planets`, `moons`, `asteroids`.
- `GET /galaxies/counts/global` returns global aggregate counts: `galaxies`, `systems`, `stars`, `planets`, `moons`, `asteroids` (admin-only).

### Systems

- `GET /systems/galaxy/:galaxyId` (Auth)
- `GET /systems/name/:name` (Auth)
- `GET /systems/position` (Auth)
- `GET /systems/:id` (Auth)
- `PATCH /systems/:id/name` (Auth)
- `PATCH /systems/:id/position` (Auth)

### Stars

- `GET /stars/system/:systemId` (Auth)
- `GET /stars/name/:name` (Auth)
- `GET /stars/:id` (Auth)
- `PATCH /stars/:id/name` (Auth)
- `PATCH /stars/:id/main` (Auth)
- `PATCH /stars/:id/orbital` (Auth)
- `PATCH /stars/:id/orbital-starter` (Auth)

### Planets

- `GET /planets/system/:systemId` (Auth)
- `GET /planets/name/:name` (Auth)
- `GET /planets/:id` (Auth)
- `PATCH /planets/:id/name` (Auth)
- `PATCH /planets/:id/orbital` (Auth)
- `PATCH /planets/:id/biome` (Auth)

### Moons

- `GET /moons/planet/:planetId` (Auth)
- `GET /moons/name/:name` (Auth)
- `GET /moons/:id` (Auth)
- `PATCH /moons/:id/name` (Auth)
- `PATCH /moons/:id/size` (Auth)
- `PATCH /moons/:id/orbital` (Auth)

### Asteroids

- `GET /asteroids/system/:systemId` (Auth)
- `GET /asteroids/name/:name` (Auth)
- `GET /asteroids/:id` (Auth)
- `PATCH /asteroids/:id/name` (Auth)
- `PATCH /asteroids/:id/type` (Auth)
- `PATCH /asteroids/:id/size` (Auth)
- `PATCH /asteroids/:id/orbital` (Auth)

### Donations

- `POST /donations/checkout` (Auth)
- `POST /donations/checkout/:sessionId/confirm` (Auth)
- `POST /donations/:id/cancel` (Auth)
- `GET /donations` (Auth)
- `GET /donations/:id` (Auth)

### Logs (Admin)

- `POST /logs` (Auth + Admin)
- `GET /logs` (Auth + Admin)
- `GET /logs/:id` (Auth + Admin)
- `PATCH /logs/:id/resolve` (Auth + Admin)

### Metrics (Admin)

- `POST /metrics/performance` (Auth + Admin)
- `GET /metrics/performance` (Auth + Admin)
- `GET /metrics/performance/dashboard` (Auth + Admin)
- `GET /metrics/performance/:id` (Auth + Admin)

## Caching Strategy (Redis)

- User: entity `1 day`, list `1 week`
- Galaxy: entity `2 weeks`, list `1 day`, populated `1 day`
- System: entity `3 days`, list `1 day`
- Star/Planet/Moon/Asteroid: entity `1 week`, list `1 day`
- Donation: entity `1 week`, list `6 hours`
- Log: entity `1 hour`, list `5 minutes`
- Metric: entity `10 minutes`, list/dashboard `1 minute`

Populate cache invalidation:

- Galaxy populate snapshots are invalidated on mutations that affect the galaxy tree (galaxy shape, system/star/planet/moon/asteroid updates, and galaxy deletion).

## Observability

- Request auditing logs:
  - all `5xx`, `401`, `403`, `429`
  - successful mutating requests (`POST`, `PATCH`, `DELETE`)
- HTTP performance middleware tracks request duration metrics.
- DB query/transaction timings are reported to metrics.
- Maintenance runs are persisted to `logs.maintenance_job_runs`.

## Migrations

`src/infra/db/migrations`:

- `000_initials.sql`
- `001_functions.sql`
- `002_auth.sql`
- `003_procedurals.sql`
- `004_logs.sql`
- `005_metrics.sql`
- `006_donations.sql`
- `007_maintenance.sql`
- `008_security_bans.sql` (security schema, user/IP bans)
- `009_fx_rates.sql` (daily FX rates for EUR normalization)

## Local Development

```bash
npm ci
docker-compose up -d
npm run migrate
npm run dev
```

## Production-like Docker

```bash
npm run docker:prod:build
npm run docker:prod:up
npm run docker:prod:migrate
```

One-command local deploy (build + migrate + run):

```bash
npm run deploy:local
```

## Quality Gates

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run validate`

Enable hooks once after clone:

```bash
npm run prepare
```

## Environment Variables (Minimum)

- App: `NODE_ENV`, `PORT`, `CORS_ORIGIN`
- DB: `DATABASE_URL`, `PGSSL`, `PGMAX`, `PGIDLE_TIMEOUT_MS`
- Redis: `REDIS_URL`, `REDIS_USERNAME`, `REDIS_PASSWORD`
- JWT: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PUBLIC_KEY`
- Maintenance: `MAINTENANCE_*`
  - FX refresh:
    - `MAINTENANCE_FX_RATES_REFRESH_INTERVAL_MIN`
    - `MAINTENANCE_FX_RATES_SOURCE_URL`
