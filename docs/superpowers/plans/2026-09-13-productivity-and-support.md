# 집간격 사용자 편의·문의 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 자동 면적 조회, 기록 필터, 주간 차트, 고유 편집형 닉네임과 GitHub 문의 접수를 완성한다.

**Architecture:** 화면에서 재사용할 계산·검증을 `lib`의 순수 함수로 분리하고 `app/page.tsx`는 상태와 Supabase 호출을 조정한다. 프로필과 문의 이력은 RLS가 적용된 Supabase 테이블에 저장하고 GitHub 토큰은 인증된 Next.js 서버 경로에서만 사용한다.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase Auth/Postgres/RLS, GitHub REST API, node:test

**Spec:** `docs/superpowers/specs/2026-09-13-productivity-and-support-design.md`

## Global Constraints

- Google·Kakao의 이름, 이메일, 사진을 앱 닉네임에 사용하지 않는다.
- GitHub Issue에 이메일, 소셜 이름, Supabase UUID를 포함하지 않는다.
- `GITHUB_ISSUES_TOKEN`과 `SUPABASE_SECRET_KEY`는 서버 전용이다.
- 새 Supabase 테이블에 RLS와 명시적 권한을 적용한다.
- 모든 동작 변경은 실패하는 테스트를 먼저 확인한다.

---

### Task 1: 주간 차트 집계

**Files:**
- Modify: `lib/model.ts`
- Modify: `tests/chart.test.ts`

**Interfaces:**
- Produces: `type Interval = 'month'|'week'`, `series(data, baseId, kind, periods, now, baseKind, interval)`

- [ ] 주간 중앙값, 월요일 경계, 이전 값 기반 가격 차이를 표현하는 실패 테스트를 추가한다.
- [ ] `npm test -- tests/chart.test.ts`로 새 테스트가 함수 계약 부재 때문에 실패하는지 확인한다.
- [ ] 월간 동작을 유지하면서 주간 버킷과 라벨을 만드는 최소 구현을 추가한다.
- [ ] 차트 테스트와 전체 테스트를 통과시킨다.

### Task 2: 가격 기록 필터

**Files:**
- Create: `lib/record-filter.ts`
- Create: `tests/record-filter.test.ts`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `filterRecords(data, {kind, propertyId, query, years, now}): Record[]`

- [ ] 단지, 기간, 단지명·출처·메모 검색과 최신순 정렬을 검증하는 실패 테스트를 추가한다.
- [ ] 새 테스트의 모듈 부재 실패를 확인한다.
- [ ] 순수 필터 함수를 구현해 테스트를 통과시킨다.
- [ ] 가격 기록 탭에 필터 컨트롤과 결과 건수를 연결하고 모바일 스타일을 추가한다.

### Task 3: 아파트 선택 직후 면적 자동 조회

**Files:**
- Create: `lib/area-search.ts`
- Create: `tests/area-search.test.ts`
- Modify: `app/components/property-address.tsx`
- Modify: `app/components/property-area.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `areaSearchKey(location): string` and address component driven area props

- [ ] 선택 위치가 바뀔 때만 새 조회 키가 생기는 실패 테스트를 추가한다.
- [ ] 테스트 실패를 확인한다.
- [ ] 면적 컴포넌트가 유효한 선택을 받으면 자동 조회하고 버튼 없이 상태와 선택란을 표시하도록 구현한다.
- [ ] 변경된 주소를 선택할 때 진행 중 요청을 취소하고 이전 면적을 지운다.

### Task 4: 고유 앱 닉네임

**Files:**
- Create: `lib/profile.ts`
- Create: `tests/profile.test.ts`
- Create: `supabase/migrations/20260913090000_add_profiles.sql`
- Modify: `supabase/schema.sql`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `Profile`, `normalizeNickname`, `nicknameValidation`; RPC `ensure_profile()`

- [ ] 공백 정규화와 길이 검증을 표현하는 실패 테스트를 추가한다.
- [ ] 테스트가 구현 부재로 실패하는지 확인한다.
- [ ] 프로필 순수 함수를 구현한다.
- [ ] 고유 닉네임을 충돌 시 재시도하는 `ensure_profile` RPC, RLS, grants가 포함된 migration을 작성한다.
- [ ] 로그인 후 프로필을 불러오고 설정에서 수정하도록 연결한다.
- [ ] 사이드바와 설정에서 소셜 이름 대신 앱 닉네임만 표시한다.

### Task 5: GitHub 문의 접수

**Files:**
- Create: `lib/support.ts`
- Create: `tests/support.test.ts`
- Create: `app/api/support/route.ts`
- Create: `supabase/migrations/20260913093000_add_support_tickets.sql`
- Modify: `supabase/schema.sql`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Produces: `validateSupportInput`, `githubIssuePayload`; authenticated `POST /api/support`

- [ ] 제목·내용·유형 검증, 개인정보 없는 GitHub payload를 표현하는 실패 테스트를 추가한다.
- [ ] 테스트가 구현 부재로 실패하는지 확인한다.
- [ ] 검증과 payload 생성을 구현한다.
- [ ] 시간당 5건 제한과 처리 상태를 위한 RLS 테이블 migration을 작성한다.
- [ ] 서버 경로에서 사용자 인증, 프로필 조회, 제한 확인, GitHub Issue 생성, 결과 저장을 구현한다.
- [ ] 설정 화면에 로그인 사용자용 문의 양식을 연결한다.
- [ ] 환경변수와 fine-grained GitHub token 설정법을 문서화한다.

### Task 6: 통합 검증

**Files:**
- Modify: `README.md`

- [ ] `npx supabase migration up --local`로 새 migration을 적용한다.
- [ ] 로컬 DB에서 테이블, RPC, RLS 정책을 조회한다.
- [ ] `npm test` 전체 결과를 확인한다.
- [ ] `npm run build` 결과를 확인한다.
- [ ] 변경 diff에서 비밀키 노출과 소셜 프로필 이름 사용이 없는지 확인한다.
