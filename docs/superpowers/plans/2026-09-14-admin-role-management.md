# Admin Role Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 최고 관리자 한 명이 기존 소셜 로그인 사용자를 일반 관리자로 추가·해제하고 최고 관리자 권한을 안전하게 이전할 수 있게 한다.

**Architecture:** `admin.admins`에 역할과 생성자를 저장하고, 모든 변경은 service-role 전용 `admin` RPC에서 트랜잭션으로 처리한다. Next.js 관리자 API는 세션과 최고 관리자 권한을 재검증하며, `/admin/admins` 화면은 닉네임과 공급자만 표시한다.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase Auth/Postgres/RLS, node:test

**Spec:** `docs/superpowers/specs/2026-09-13-admin-role-management-design.md`

## Global Constraints

- 현재 스키마 이름은 `admin.admins`, `admin.audit_events`, `app.profiles`다.
- 최고 관리자는 정확히 한 명이어야 한다.
- 이메일, 토큰, 내부 DB 오류를 브라우저 응답과 감사 메타데이터에 포함하지 않는다.
- 일반 관리자는 기존 관리자 기능을 사용하지만 관리자 역할은 변경할 수 없다.
- 모든 관리자 DB 접근은 서버 service-role 클라이언트의 `.schema('admin')`을 사용한다.

---

### Task 1: Role schema and transactional RPCs

**Files:**
- Create: `supabase/migrations/20260914010000_add_admin_role_management.sql`
- Modify: `supabase/zipup_supabase_reset.sql`
- Test: `tests/admin-role-schema.test.ts`

**Interfaces:**
- Produces: `admin.admins.role`, `admin.admins.created_by`, `admin.is_super_admin()`, `admin.grant_admin(uuid,uuid,uuid)`, `admin.revoke_admin(uuid,uuid,uuid)`, `admin.transfer_super_admin(uuid,uuid,uuid)`.
- Guarantees: role 변경과 `admin.audit_events` 기록이 한 트랜잭션에서 완료된다.

- [x] **Step 1: Write the failing schema contract test**

Assert the migration contains the role constraint, single-super-admin unique index, locked-down grants, transactional RPCs, and `admin.grant|revoke|transfer` audit actions.

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/admin-role-schema.test.ts`
Expected: FAIL because the migration and RPCs do not exist.

- [x] **Step 3: Implement the migration**

Add `role text not null default 'admin' check (role in ('super_admin','admin'))`, nullable `created_by`, and a partial unique index for `role='super_admin'`. Expand the audit action check. Define security-invoker service-role-only RPCs that validate actor/target roles, reject self/last-super-admin removal, mutate rows, and insert sanitized audit events.

- [x] **Step 4: Keep clean reset SQL equivalent**

Apply the same final table shape, indexes, functions, grants, and checks to `supabase/zipup_supabase_reset.sql`, then copy it to the split-schema migration only if reset parity requires it without rewriting historical migrations.

- [x] **Step 5: Verify and commit**

Run: `npx tsx --test tests/admin-role-schema.test.ts && npm test`
Commit: `feat: add administrator role schema`

### Task 2: Server authorization and projections

**Files:**
- Modify: `lib/admin-server.ts`
- Create: `lib/admin-roles.ts`
- Test: `tests/admin-roles.test.ts`

**Interfaces:**
- Produces: `requireSuperAdmin(request)`, `adminRoleProjection(...)`, `adminRoleError(...)`.
- Consumes: `admin.is_super_admin()` and existing `requireAdmin(request)`.

- [x] **Step 1: Write failing authorization and projection tests**

Cover non-admin, ordinary admin, super admin, safe public errors, UUID validation, and projections that omit email.

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/admin-roles.test.ts`
Expected: FAIL because helpers are absent.

- [x] **Step 3: Implement minimal helpers**

Build `requireSuperAdmin` on the authenticated server session and `.schema('admin').rpc('is_super_admin')`. Return only user ID, nickname, provider, joined date, role, added date, and creator nickname.

- [x] **Step 4: Verify and commit**

Run: `npx tsx --test tests/admin-roles.test.ts && npx tsc --noEmit`
Commit: `feat: enforce super administrator access`

### Task 3: Administrator management API

**Files:**
- Create: `app/api/admin/admins/route.ts`
- Create: `app/api/admin/admins/[userId]/route.ts`
- Create: `app/api/admin/admins/transfer/route.ts`
- Test: `tests/admin-role-api.test.ts`

**Interfaces:**
- Produces: `GET/POST /api/admin/admins`, `DELETE /api/admin/admins/:userId`, `POST /api/admin/admins/transfer`.
- Consumes: `requireSuperAdmin`, service-role Auth user lookup, role RPCs.

- [x] **Step 1: Write failing API contract tests**

Cover search/list, social-provider eligibility, duplicate grant conflict, revoke rules, transfer rules, 401/403/404/409 mapping, and generic 500 responses.

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/admin-role-api.test.ts`
Expected: FAIL because routes are absent.

- [x] **Step 3: Implement GET and POST**

Join `admin.admins`, `app.profiles`, and sanitized Supabase Auth provider metadata on the server. Search by nickname only. Require target provider `google` or `kakao`, then call `admin.grant_admin`.

- [x] **Step 4: Implement DELETE and transfer**

Validate UUID path/body inputs and delegate atomic changes to `admin.revoke_admin` and `admin.transfer_super_admin`. Map known domain failures to safe HTTP responses and unexpected failures through `serverError`.

- [x] **Step 5: Verify and commit**

Run: `npx tsx --test tests/admin-role-api.test.ts && npm test`
Commit: `feat: add administrator management API`

### Task 4: Administrator management screen

**Files:**
- Create: `app/admin/admins/page.tsx`
- Modify: `app/components/admin-nav.tsx`
- Modify: `app/globals.css`
- Test: `tests/admin-role-page.test.ts`

**Interfaces:**
- Consumes: Task 3 APIs.
- Produces: `/admin/admins` role list, nickname search, grant/revoke actions, and explicit transfer confirmation.

- [x] **Step 1: Write failing page contract tests**

Assert the route, nav item, role labels, no-email rendering, search, revoke, and transfer controls exist.

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/admin-role-page.test.ts`
Expected: FAIL because page and nav item are absent.

- [x] **Step 3: Implement the page**

Follow existing admin session/header patterns. Show the super-admin card, ordinary administrators, nickname search results, and audit rows. Require typed confirmation before transfer and refresh data after every successful mutation.

- [x] **Step 4: Add navigation and responsive styles**

Show `관리자 관리` in `AdminNav`; ordinary admins may see the item but receive the page's 권한 없음 state without role data.

- [x] **Step 5: Verify and commit**

Run: `npx tsx --test tests/admin-role-page.test.ts && npm run build`
Commit: `feat: add administrator management screen`

### Task 5: Bootstrap, documentation, and end-to-end verification

**Files:**
- Modify: `README.md`
- Modify: `supabase/seed.sql`
- Test: `tests/schema-routing.test.ts`

**Interfaces:**
- Produces: documented production bootstrap SQL and repeatable local super-admin setup.

- [x] **Step 1: Update bootstrap behavior**

Keep credentials in ignored `.env.local`. Ensure the local admin bootstrap inserts `role='super_admin'`; production instructions create one confirmed Auth email/password user and insert its UUID into `admin.admins` with that role.

- [x] **Step 2: Update documentation**

Document role boundaries, one-super-admin rule, adding social users, transfer behavior, Data API schema exposure, and recovery SQL that does not expose credentials.

- [x] **Step 3: Search for stale identifiers and unsafe output**

Run: `rg -n "public\.app_admins|app_admins|admin_audit_events|\.from\('admins'\)" app lib README.md tests`
Review each remaining match; all runtime `admins` access must be explicitly on `.schema('admin')`.

- [x] **Step 4: Run complete verification**

Run: `npm test`
Run: `npx tsc --noEmit`
Run: `npm run build`
Run: `git diff --check`
Expected: all commands succeed and no secret-bearing file is tracked.

- [x] **Step 5: Commit**

Commit: `docs: document administrator role management`
