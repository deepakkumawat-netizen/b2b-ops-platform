# B2B Ops Platform

School onboarding & lifecycle tracker for CodeVidhya's B2B Operations team — implements the
10-phase SOP (Sales handover → Welcome → Orientation → Onboarding setup → Data collection/LMS →
Infra diagnostic → Teacher training → Ongoing engagement → Competitions → Annual renewal) as a
lifecycle tracker with per-phase checklists, a dashboard, and real email touchpoints (welcome
email, workshop confirmation/reminder/completion) via Resend.

## Stack

NestJS + Prisma/Postgres backend, React/Vite frontend, npm-workspaces monorepo with a
`packages/shared` enum package shared between both.

## Local setup

```bash
npm install
docker compose up -d          # Postgres on localhost:5432
cp backend/.env.example backend/.env
npm run prisma:migrate        # creates tables
npm run prisma:seed           # phase-task templates + one dev Staff per role
npm run dev:backend           # http://localhost:3000/api
npm run dev:frontend          # http://localhost:5173
```

Seeded dev logins (password `changeme123` for all):

| Role            | Email               |
| --------------- | ------------------- |
| SUPER_ADMIN     | admin@b2bops.dev    |
| SALES           | sales@b2bops.dev    |
| ACCOUNT_MANAGER | am@b2bops.dev       |
| OPERATIONS      | ops@b2bops.dev      |
| TRAINING        | training@b2bops.dev |

Welcome/workshop emails are skipped (and logged as `SKIPPED` in `EmailLog`) unless
`RESEND_API_KEY` is set in `backend/.env`.

## Staff accounts

New people request an account at `/signup` using an email on `SIGNUP_ALLOWED_DOMAINS`
(default `codevidhya.com`). They can't pick Super Admin, and the account can't sign in
until a Super Admin approves it on the **Staff** page. The same page is where roles are
changed and leavers are deactivated. Sessions use an httpOnly, SameSite=Strict cookie, so
the JWT is never readable from page JavaScript.

## Deploying to Render

`render.yaml` provisions a single web service (the backend serves the built
frontend itself). In the Render dashboard: **New +** → **Blueprint** → point
it at this repo. After the first deploy, set `DATABASE_URL` (your Neon
connection string) in the service's environment tab.

Then add these GitHub repository secrets (**Settings → Secrets and variables → Actions**):

| Secret         | Value                                                        | Used by                          |
| -------------- | ------------------------------------------------------------ | -------------------------------- |
| `DATABASE_URL` | the same Neon connection string                              | `migrate.yml`                    |
| `APP_URL`      | e.g. `https://b2b-ops-platform.onrender.com`                 | `daily-agents.yml`               |
| `CRON_SECRET`  | the value Render generated for the `CRON_SECRET` env var     | `daily-agents.yml`               |

GitHub Actions workflows (`.github/workflows/`):

- **`ci.yml`** type-checks, tests and builds on every push and PR.
- **`migrate.yml`** runs `prisma migrate deploy` against Neon whenever a migration lands on
  `master`. It can also be run manually from the Actions tab. (`prisma migrate deploy` isn't
  run in Render's build step because its migration engine can't reliably reach Neon from
  Render's network, even though the app itself connects fine via the Neon driver adapter in
  `prisma.service.ts`.)
- **`daily-agents.yml`** wakes the app and runs the AI agents at 8:00 IST. The in-app
  `@Cron` can't be relied on because Render's free plan sleeps the service.

To seed a fresh database once:

```bash
DATABASE_URL="<neon connection string>" npx prisma db seed --schema=backend/prisma/schema.prisma
```

## Structure

- `backend/src/schools` — the School record + SOP phase, scoped via `common/scope.ts`'s
  `schoolScopeWhere`/`assertSchoolAccess` (an ACCOUNT_MANAGER only sees their assigned schools).
- `backend/src/phase-tasks` — the per-school checklist engine, seeded from
  `backend/prisma/seed.ts`'s `PHASE_TASK_TEMPLATES`.
- `backend/src/workshops`, `engagement`, `competitions`, `renewals`, `teachers`,
  `infra-diagnostics` — one module per SOP sub-area.
- `backend/src/notifications` — `MailerService` (Resend) + `NotificationsService`, which logs
  every email attempt to `EmailLog` regardless of whether it actually sent.
- `backend/src/dashboard` — schools-by-phase, overdue visits/calls, upcoming workshops, pending
  renewals.
- `backend/src/activity` — per-school audit trail (`SchoolActivity`), merged with email logs,
  agent actions and visits/calls into each school's **Activity** tab.
- `backend/src/staff` — Super Admin staff management (approve, change role, deactivate).
- `backend/src/common/time.ts` — business-timezone (`APP_TIMEZONE`, default IST) date helpers.
  Use these instead of `setHours`/`getFullYear`/`toLocaleString`, because the server runs on UTC.
- `frontend/src/features/schools/SchoolDetailPage.tsx` — the tabbed per-school workspace
  (Checklist / Teachers / Infra / Workshops / Engagement / Competitions / Renewal / Activity).
