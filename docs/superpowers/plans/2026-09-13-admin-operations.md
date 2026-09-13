# Admin Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a protected admin area for support triage and weekly trade-sync monitoring while keeping technical errors in server logs.

**Architecture:** Reuse `app_admins` for authorization and move GitHub creation behind an admin-only API. Extract weekly collection into a shared server function that records sanitized run summaries in Supabase. Standardize public errors with request IDs and structured server logging.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Auth/Postgres/Storage, GitHub REST API, Vercel Cron

**Spec:** `docs/superpowers/specs/2026-09-13-admin-operations-design.md`

## Global Constraints

- GitHub tokens and Supabase secret keys remain server-only.
- User-facing errors never include provider errors, environment variable names, stack traces, SQL, tokens, or internal identifiers other than a generated request ID.
- Support attachment objects remain private and are viewed with short-lived signed URLs.
- Existing user data and uncommitted work must be preserved.

---

### Task 1: Safe API errors

**Files:**
- Create: `lib/api-error.ts`
- Create: `tests/api-error.test.ts`
- Modify: `app/api/**/*.ts`

**Interfaces:**
- Produces: `serverError(operation: string, error: unknown, publicMessage: string, status?: number): Response`
- Produces: `logServerError(operation: string, requestId: string, error: unknown, context?: Record<string, unknown>): void`

- [x] Write tests proving internal messages and secrets are absent from responses and logs use a request ID.
- [x] Run the focused test and observe failure because the helper does not exist.
- [x] Implement the helper and replace raw caught-error responses in public/admin APIs.
- [x] Run focused and full tests.

### Task 2: Admin-selected GitHub issue creation

**Files:**
- Modify: `app/api/support/route.ts`
- Modify: `app/api/support/[ticketId]/messages/route.ts`
- Create: `app/api/admin/support/[ticketId]/github/route.ts`
- Modify: `lib/support.ts`
- Modify: `tests/support.test.ts`

**Interfaces:**
- Produces: admin-only `POST /api/admin/support/:ticketId/github` accepting `{title?: string, body?: string}`.
- Consumes: existing `githubIssuePayload` redaction and `supportServer` authorization.

- [ ] Write route-level tests showing user intake and replies do not call GitHub automatically.
- [ ] Run the route-level tests against authenticated test users.
- [x] Remove automatic GitHub calls from user routes and implement idempotent admin issue creation.
- [x] Run focused tests.

### Task 3: Complete admin support inbox

**Files:**
- Modify: `app/api/admin/support/route.ts`
- Modify: `app/api/admin/support/[ticketId]/route.ts`
- Modify: `app/admin/support/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: ticket list filters and detailed messages/attachments with signed URLs.
- Consumes: admin session validation and private `support-attachments` bucket.

- [ ] Add integration tests for admin filters and ticket detail shape.
- [x] Implement list filters and a detail GET endpoint.
- [x] Build the desktop/mobile admin inquiry layout, image preview, reply, state actions, GitHub transfer, and logout.
- [x] Run focused tests and TypeScript build.

### Task 4: Weekly sync run tracking

**Files:**
- Create: `supabase/migrations/*_add_trade_sync_runs.sql`
- Create: `lib/sync-status.ts`
- Create: `tests/sync-status.test.ts`
- Create: `lib/weekly-sync-server.ts`
- Modify: `app/api/cron/trades/route.ts`
- Create: `app/api/admin/sync/route.ts`

**Interfaces:**
- Produces: `runWeeklyTradeSync(trigger: 'cron'|'manual'): Promise<SyncRunSummary>`.
- Produces: admin-only `GET /api/admin/sync` and `POST /api/admin/sync`.

- [x] Write tests for status labels, delayed detection, and summary sanitization.
- [x] Run the focused test and observe failure.
- [x] Add the migration with service-role-only run records and indexes.
- [x] Extract the collector, record start/completion/failure, and prevent concurrent runs.
- [x] Connect cron and admin endpoints to the shared collector.
- [x] Apply the local migration and run database lint.

### Task 5: Admin sync dashboard and final verification

**Files:**
- Create: `app/admin/page.tsx`
- Create: `app/admin/sync/page.tsx`
- Modify: `app/admin/support/page.tsx`
- Modify: `app/globals.css`
- Modify: `README.md`

**Interfaces:**
- Consumes: admin support and sync APIs.

- [x] Add shared admin navigation, logout, run cards, delayed warning, failure list, and manual-run action.
- [ ] Verify non-admin redirects and API rejection with a separate authenticated test account.
- [x] Run `npm test`, `npm run build`, and local Supabase lint.
- [x] Review the diff for exposed secrets and raw error messages.
