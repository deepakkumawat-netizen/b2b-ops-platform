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

## Deploying to Render

`render.yaml` provisions a single web service (the backend serves the built
frontend itself). In the Render dashboard: **New +** → **Blueprint** → point
it at this repo. After the first deploy, set `DATABASE_URL` (your Neon
connection string) in the service's environment tab, then run the migration
once from a machine with direct DB access:

```bash
DATABASE_URL="<neon connection string>" npx prisma migrate deploy --schema=backend/prisma/schema.prisma
DATABASE_URL="<neon connection string>" npx prisma db seed --schema=backend/prisma/schema.prisma
```

(`prisma migrate deploy` isn't run in Render's build step — its migration
engine can't reliably reach Neon from Render's network, even though the app
itself connects fine via the Neon driver adapter in `prisma.service.ts`.)

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
- `frontend/src/features/schools/SchoolDetailPage.tsx` — the tabbed per-school workspace
  (Checklist / Teachers / Infra / Workshops / Engagement / Competitions / Renewal).
