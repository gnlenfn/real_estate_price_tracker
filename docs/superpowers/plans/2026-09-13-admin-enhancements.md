# 관리자 추가 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 홈, 실패 대상 재수집, 내부 메모, 활동 기록, 사용자 조회, 연동 점검을 추가한다.

**Architecture:** 기존 `/admin` 및 `app_admins` 권한 구조를 확장한다. 운영 기록은 서버 전용 테이블에 저장하고, 관리자 API가 권한 검사 후 필요한 필드만 반환한다. 세 단계는 각각 검증하고 배포할 수 있으며 기존 수집 함수와 문의 데이터를 재사용한다.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Auth/Postgres/Storage, Vercel Cron, GitHub REST API, node:test.

**Spec:** 이 문서의 「확정 요구사항」 및 `docs/superpowers/specs/2026-09-13-admin-operations-design.md`. GitHub 자동 전송 관련 과거 문서보다 이 문서와 관리자 운영 설계를 우선한다.

## Global Constraints

- 일반 사용자에게 관리자 링크와 내부 메모를 노출하지 않는다.
- 모든 관리자 API는 서버에서 인증과 `app_admins` 권한을 검사한다.
- 기술적 오류 원문은 Vercel 서버 로그에만 기록한다. 관리자 화면에는 안전한 안내와 추적 ID를 제공한다.
- API 키, 토큰, 쿠키, 비밀번호, 문의 원문, 이미지 데이터를 로그에 기록하지 않는다.
- 기존 문의와 가격 기록을 유지하며 추가 마이그레이션으로 배포한다. 운영 DB 초기화는 하지 않는다.
- GitHub 전송은 관리자가 선택한 내용만 대상으로 하며, 내부 메모를 자동 포함하지 않는다.
- 계획 작성 단계에서는 코드 구현, 계정 변경, 데이터 변경, 커밋·푸시를 수행하지 않는다.

## 확정 요구사항

### 1단계: 운영 요약과 실패 복구

`/admin`은 미답변 문의 수, 최근 7일 신규 문의, 최근 예약 수집 결과와 지연 여부, 최근 실패 실행을 표시한다. 수동 실행 성공이 예약 실행 미작동을 가리지 않도록 예약과 수동 실행 상태를 구분한다. 카드에서 필터가 적용된 문의 목록과 수집 상세로 이동한다.

수집 상세에는 시작·완료 시각, 실행 방식, 원본 실행, 처리·실패 건수, 실패한 단지·월을 표시한다. 재시도는 원본 실행의 실패 단지·월만 대상으로 하며 삭제된 단지는 건너뛴 수를 기록한다. 전체 수집과 재시도는 하나의 실행 잠금을 공유한다. 실패 목록을 확정하지 못한 실행 전체 오류에는 실패 대상 재시도를 제공하지 않고 전체 실행을 안내한다.

### 2단계: 문의 업무 기록

사용자 답변과 내부 메모는 입력 영역을 분리한다. 내부 메모는 별도 테이블에 저장하며 사용자 API·Storage·GitHub 전송에서 조회하지 않는다. 메모는 작성 후 수정·삭제하지 않고 정정 메모를 추가한다.

관리자 활동 기록은 답변, 내부 메모 작성, 상태 변경, GitHub 전송, 수집 시작·완료·실패를 기록한다. 관리자 ID, 작업 종류, 대상 ID, 이전·이후 상태, 요청 추적 ID와 시각을 저장한다. 답변·메모 원문은 활동 기록에 복제하지 않는다. 관리자 화면에서는 읽기만 허용한다.

### 3단계: 사용자와 연동 조회

사용자 목록은 닉네임, 가입일, 등록 단지 수, 문의 수, 마지막으로 기록한 앱 활동 시각을 제공한다. 계정 정지·삭제, 권한 변경, 가격 상세 조회는 이번 범위에서 제외한다. 기존 사용자의 활동 시각을 가입일이나 로그인 시각으로 대체하지 않으며, 데이터가 없으면 ‘기록 없음’으로 표시한다.

연동 화면은 Supabase, 국토교통부, 카카오 검색, GitHub의 설정 여부와 마지막 점검 결과·시각을 표시한다. ‘설정됨’과 ‘실제 호출 성공’을 구분한다. 점검은 관리자 수동 요청으로 실행하고 외부 쓰기나 테스트 이슈 생성을 하지 않는다. 실제 요청 결과가 없는 서비스는 ‘미확인’으로 표시한다.

## 현재 상태와 구현 전 점검

- `app/admin/page.tsx`는 현재 문의 화면으로 이동한다.
- `lib/weekly-sync-server.ts`는 직전·현재 월 전체 수집과 실행 이력을 담당한다.
- `lib/sync-status.ts`는 최신 실행의 경과 시간만 판단하므로 예약 기준 계산이 필요하다.
- `app/api/admin/support/route.ts`는 최대 200건을 가져온 뒤 검색한다. 사용자 증가에 대비해 서버 검색과 페이지 나누기를 먼저 정리한다.
- `app/api/admin/support/[ticketId]/github/route.ts`는 전송 상태 잠금을 사용한다. 외부 생성 성공 후 DB 저장 실패·응답 유실 시 재전송으로 중복 이슈가 생길 수 있으므로 결과 불명 상태와 수동 확인 경로를 추가한다.
- 기존 테스트 통과만으로 실제 관리자·일반 사용자 격리가 검증된 것은 아니다. 별도 로컬 테스트 계정으로 API와 RLS를 검증한다.

## Task 1: 공통 관리자 권한과 활동 기록 기반

**Files:** 생성 `lib/admin-server.ts`, `lib/admin-audit.ts`, `tests/admin-access.test.ts`, `tests/integration/admin-access.test.ts`. 수정 `app/api/admin/**/route.ts`, `supabase/schema.sql`, `supabase/production-reset.sql`. 마이그레이션은 구현 시 `npx supabase migration new add_admin_audit_events`로 생성한 실제 파일을 사용한다.

**Interfaces:** `requireAdmin(request: Request)`는 `{user,admin}`을 반환하며 미인증 401·비관리자 403을 구분한다. `appendAdminEvent(db, event)`의 이벤트 타입은 아래와 같다.

```ts
type AdminEvent = {
 actorId: string | null;
 action: 'support.reply' | 'support.note' | 'support.status' | 'github.transfer' | 'sync.start' | 'sync.finish';
 targetId: string;
 requestId: string;
 outcome: 'success' | 'failed' | 'unknown';
 beforeStatus?: string;
 afterStatus?: string;
};
```

- [ ] 먼저 별도 로컬 관리자·일반 사용자·미인증 요청으로 보호된 API를 호출하는 통합 테스트를 작성한다. 핵심 단언은 다음과 같다.

```ts
assert.equal(anonymousResponse.status, 401);
assert.equal(regularUserResponse.status, 403);
assert.equal(adminResponse.status, 200);
assert.equal(Object.hasOwn(await regularUserResponse.json(), 'stack'), false);
```

- [ ] `node --import tsx --test tests/integration/admin-access.test.ts`로 기존 응답 불일치를 확인한다. fixture 계정은 loopback Supabase에서만 생성하고 테스트 후 삭제한다. 키·토큰은 출력하지 않는다.
- [x] `admin_audit_events`에 `id`, `actor_id`, `action`, `target_id`, `request_id`, `outcome`, `before_status`, `after_status`, `created_at`을 추가한다. 시간순·대상별 인덱스를 생성한다.

```sql
alter table public.admin_audit_events enable row level security;
revoke all on public.admin_audit_events from public, anon, authenticated;
grant select, insert on public.admin_audit_events to service_role;
```

- [x] `requireAdmin`을 모든 관리자 API에 적용한다. 내부 예외는 `serverError`로 기록하고 안전한 응답으로 변환한다.
- [ ] DB 내 답변·상태 변경과 활동 기록은 하나의 트랜잭션으로 저장한다. 외부 GitHub 호출은 시작 이벤트 후 결과 이벤트를 별도로 남겨 DB 원자성과 구분한다.
- [x] 권한 테스트와 활동 기록 원문 비포함 테스트를 통과시킨다. 실패 로그에는 사용자 제공 원문 대신 오류 코드·작업명·추적 ID만 허용한다.

## Task 2: 실패 대상 재수집

**Files:** 수정 `lib/weekly-sync-server.ts`, `lib/weekly-sync.ts`, `app/api/admin/sync/route.ts`, `app/admin/sync/page.tsx`. 생성 `lib/sync-retry.ts`, `app/api/admin/sync/[runId]/route.ts`, `app/api/admin/sync/[runId]/retry/route.ts`, `tests/sync-retry.test.ts`. CLI 마이그레이션 이름 `add_sync_retry_metadata`.

**Interfaces:** `retryTargets(failures): Array<{propertyId:string;month:string}>`; `runWeeklyTradeSync(trigger: 'cron'|'manual', options?: {retryOf:string;actorId:string})`. `GET /api/admin/sync/:runId`는 실행 상세를, `POST /api/admin/sync/:runId/retry`는 새 실행 ID를 반환한다.

- [x] 중복 제거와 단지·월 쌍 보존 테스트를 먼저 작성한다.

```ts
assert.deepEqual(retryTargets([
 {propertyId:'a',month:'2026-08'},
 {propertyId:'a',month:'2026-08'},
 {propertyId:'b',month:'2026-09'},
]), [{propertyId:'a',month:'2026-08'},{propertyId:'b',month:'2026-09'}]);
```

- [x] `node --import tsx --test tests/sync-retry.test.ts`에서 실패를 확인한다.
- [x] 실행 이력에 `retry_of uuid`, `actor_id uuid`, `skipped_count integer`, `failure_scope text`를 추가한다. `failure_scope`는 `targets` 또는 `run`이다. 재시도 원본은 서버에서 조회하며 클라이언트가 임의 대상 목록을 지정하지 못하게 한다.
- [x] 수집 작업을 정확한 단지·월 쌍으로 구성한다. 지역·월 외부 호출은 공유하되 성공했던 단지·월은 다시 저장하지 않는다.

```ts
const targets = retryTargets(original.failures);
// 저장 요청이 targets에 포함된 쌍인지 검증하며,
// 전체 properties × months 조합으로 재확장하지 않는다.
```

- [ ] 기존 단일 실행 잠금을 재사용한다. 실행 중 재요청은 409, 성공 실행 재시도는 409, 대상이 모두 삭제됐으면 외부 호출 없이 건너뜀 결과를 기록한다.
- [ ] 상세 화면에 원본 실행 링크·완료 시각·재시도 버튼을 추가한다. 실행 중에는 상태를 주기적으로 새로 읽고 화면 이탈로 실행 결과를 잃지 않게 한다.
- [ ] 통합 테스트로 성공 대상 미호출, 삭제 대상 제외, 동시 요청 중 하나만 실행되는지 검증한다. 수집 시작·결과 활동 기록도 확인한다.

## Task 3: 관리자 홈과 예약 실행 판정

**Files:** 수정 `app/admin/page.tsx`, `app/components/admin-nav.tsx`, `lib/sync-status.ts`. 생성 `app/api/admin/overview/route.ts`, `lib/admin-overview.ts`, `tests/admin-overview.test.ts`.

**Interfaces:** `weeklySchedule(now: Date): {previous: Date;next: Date}`는 기존 일요일 18:00 UTC 예약을 계산한다. `GET /api/admin/overview` 응답은 아래 구조다.

```ts
type AdminOverview = {
 unansweredCount: number;
 newTicketCount7d: number;
 cron: {health: 'running'|'success'|'partial'|'failed'|'delayed'|'unverified';lastRunId:string|null;nextAt:string};
 recentFailures: Array<{id:string;startedAt:string;failureCount:number}>;
};
```

- [x] 월요일 경계와 수동 실행이 예약 실패를 가리지 않는 테스트를 작성한다.

```ts
const schedule = weeklySchedule(new Date('2026-09-13T17:59:00Z'));
assert.equal(schedule.next.toISOString(),'2026-09-13T18:00:00.000Z');
// cron 실패 후 manual 성공 fixture에서도 cron.health는 failed여야 한다.
assert.equal(overview.cron.health,'failed');
```

- [x] 테스트 실패를 확인한 뒤 예약 판정 함수를 구현한다. 예약 시각 후 1시간 유예를 두고 지연을 판단한다. 배포 직후 기록이 없고 첫 예정 시각이 지나지 않았으면 ‘미확인’으로 표시한다. 기준 활성화 시각은 서버 설정으로 저장한다.
- [x] 개수는 DB count 쿼리로 계산하고 200건 제한 목록에서 집계하지 않는다. 최근 7일은 요청 시각에서 7일 이전부터의 접수다. 예약 실행은 `trigger='cron'`만 조회한다.
- [x] 홈 카드와 최근 실패 바로가기를 추가한다. 문의 화면은 URL 필터를 초기 상태로 읽도록 변경한다.
- [ ] 예약 경계, 실행 중 15분 초과, 실패·부분 실패, 최초 설치, 문의 200건 초과 fixture를 검증한다.

## Task 4: 내부 메모와 활동 이력 화면

**Files:** 생성 `app/api/admin/support/[ticketId]/notes/route.ts`, `app/api/admin/activity/route.ts`, `app/admin/activity/page.tsx`, `tests/integration/admin-notes.test.ts`. 수정 문의 상세 API·화면 및 관리자 내비게이션. CLI 마이그레이션 이름 `add_support_internal_notes`.

**Interfaces:** `POST /api/admin/support/:ticketId/notes`는 `{body:string}`을 받아 생성 ID·시각만 반환한다. 메모 본문은 공백 제거 후 1~4000자. 활동 목록은 `action`, `targetId`, cursor와 최대 50건 페이지를 지원한다.

- [ ] 일반 사용자에게 메모가 보이지 않는 통합 테스트를 먼저 작성한다.

```ts
assert.equal(userNotesResponse.status,403);
assert.equal(JSON.stringify(userTicketBody).includes(privateNoteText),false);
assert.equal(JSON.stringify(githubPayload).includes(privateNoteText),false);
```

- [x] `support_internal_notes(id,ticket_id,author_id,body,created_at)`를 만들고 RLS를 켠다. `authenticated`, `anon` 권한을 모두 회수하고 서버 역할에 select·insert만 부여한다.
- [x] 메모 저장과 `support.note` 활동 기록을 트랜잭션으로 묶는다. 사용자용 `support_messages`에는 내부 메모를 저장하지 않는다.
- [x] 문의 상세에 ‘내부 메모’ 입력과 목록을 별도 배경·제목으로 표시한다. 답변 보내기와 메모 저장 버튼을 분리한다.
- [ ] 관리자 활동 페이지에서 날짜·작업 종류를 필터링하고 대상 화면으로 연결한다. 개인정보 원문 대신 작업 요약만 표시한다.
- [ ] 빈 메모, 4001자 메모, 존재하지 않는 문의, 일반 사용자 DB 직접 조회 차단을 검증한다.

## Task 5: 읽기 전용 사용자 조회

**Files:** 생성 `app/api/admin/users/route.ts`, `app/admin/users/page.tsx`, `lib/admin-users.ts`, `tests/admin-users.test.ts`. 수정 `app/components/admin-nav.tsx`. CLI 마이그레이션 이름 `add_user_activity_summary`.

**Interfaces:** 응답 `{users:Array<{id:string;nickname:string;joinedAt:string;propertyCount:number;ticketCount:number;lastActivityAt:string|null}>,nextCursor:string|null}`. 이메일·소셜 원본 프로필은 반환하지 않는다.

- [x] 원본 사용자 데이터에서 허용 필드만 반환하는 테스트를 작성한다.

```ts
assert.equal(Object.hasOwn(result,'email'),false);
assert.equal(Object.hasOwn(result,'raw_user_meta_data'),false);
assert.equal(result.lastActivityAt,null);
```

- [x] 가입 시각·개수 집계를 위한 서버 전용 SQL 함수를 만든다. RPC는 service_role에만 실행 권한을 부여하고 검색 문자열을 SQL 파라미터로 전달한다. 닉네임 검색과 가입일·ID 기준 페이지 나누기를 사용한다.
- [x] `user_activity_summary(user_id,last_activity_at)`를 추가한다. 단지·가격·문의·사용자 답글 쓰기 성공 시 DB 트리거로 갱신한다. 관리자 답변은 대상 사용자의 활동으로 집계하지 않는다. 기존 행을 가입일로 채우지 않는다.
- [x] 사용자 목록과 문의 필터 바로가기를 추가한다. 정지·삭제·관리자 승격 버튼은 추가하지 않는다.
- [ ] 동일 가입시각 사용자 페이지 중복·누락, 기록 없는 사용자, 관리자 행동의 잘못된 활동 갱신을 검증한다.

## Task 6: 연동 상태 점검

**Files:** 생성 `lib/integration-checks.ts`, `app/api/admin/integrations/route.ts`, `app/api/admin/integrations/[service]/check/route.ts`, `app/admin/integrations/page.tsx`, `tests/integration-checks.test.ts`. CLI 마이그레이션 이름 `add_integration_checks`.

**Interfaces:** 서비스 이름은 `supabase|molit|kakao|github`. `runIntegrationCheck(service)`는 `{status:'success'|'failed'|'unconfigured',checkedAt:string,requestId:string}`을 반환한다. GET은 마지막 기록과 설정 여부만 반환하며 외부 호출하지 않는다.

- [x] 미설정 서비스가 외부 요청을 하지 않고, GitHub 점검이 쓰기 요청을 보내지 않는 테스트를 작성한다.

```ts
assert.equal(result.status,'unconfigured');
assert.equal(requests.length,0);
assert.equal(githubRequests.every(request=>request.method==='GET'),true);
```

- [x] Supabase는 실행 이력 테이블의 최대 1행 조회, GitHub는 설정된 저장소의 이슈 1건 조회, 카카오는 고정 검색어 1건 조회, 국토교통부는 고정 지역·최근 월 1페이지 조회로 점검한다. XML 정상 응답과 실제 성공 코드를 모두 확인한다. 이슈 조회 성공은 쓰기 권한 확인과 별개임을 표시한다.
- [x] 서비스별 10초 제한과 DB 기반 60초 재점검 제한을 둔다. 지정 서비스 외 입력은 400으로 반환하고 클라이언트 제공 URL에는 요청하지 않는다.
- [x] `integration_checks`에 서비스·점검시각·결과·추적 ID만 저장한다. 원본 응답·키는 저장하지 않는다. 기술적 오류는 서버 로그에만 남긴다.
- [x] 화면에 설정됨·미설정, 미확인·성공·실패, 점검 시각과 수동 점검 버튼을 표시한다.
- [ ] 타임아웃, XML 오류, 읽기 권한 부족, 쿨다운, 비관리자 접근 차단을 검증한다.

## Task 7: 기존 운영 흐름 보강과 배포 검증

**Files:** 수정 GitHub 전송 API·문의 상세·`README.md`, `supabase/schema.sql`, `supabase/production-reset.sql`. 생성 `tests/integration/admin-workflows.test.ts`.

- [ ] GitHub 요청의 결과가 불명확한 경우를 `unknown`으로 구분하고 자동 재전송을 막는다. 명확히 거절된 응답만 재시도를 허용한다. 관리자는 실제 이슈를 확인해 기존 이슈 번호를 연결할 수 있으며 서버가 지정 저장소 소속을 검증한다.
- [ ] 이미 연결된 문의에서 선택한 사용자 메시지를 댓글로 보내는 관리자 전용 동작을 추가한다. 메시지 ID의 문의 소속을 검사하고 내부 메모 ID는 허용하지 않는다. 메시지별 전송 상태로 중복 요청을 차단한다.
- [x] 문의 목록 검색·페이지 나누기를 DB에서 수행한다. 페이지당 50건, 안정적인 시각·ID 정렬을 사용한다. 상태·유형·닉네임 검색을 페이지 제한 전에 적용한다.
- [x] 개발·운영 배포 안내에 적용할 마이그레이션 순서와 되돌리기 방안을 추가한다. 테이블은 데이터 보존을 위해 되돌릴 때 삭제하지 않고 기능만 비활성화한다.
- [ ] 로컬 DB 마이그레이션을 적용하고 일반 사용자·관리자 API 통합 테스트를 실행한다. 테스트는 운영 URL에서 실행을 거부한다.

```sh
npm test
node --import tsx --test tests/integration/*.test.ts
npm run build
npx supabase db lint --local --level warning
git diff --check
```

- [ ] PC·모바일에서 홈 → 문의 → 내부 메모·답변 → 수집 상세·재시도 → 사용자·연동 화면을 확인한다. 세션 만료 시 데이터를 지우고 로그인 화면으로 이동하는지 확인한다.
- [ ] 환경변수와 관리자 비밀번호가 Git 추적 대상이 아닌지 확인한다. 완료한 작업만 체크하고 실제 외부 서비스 미검증 항목은 별도로 기록한다.

## 완료 기준

- [ ] 6개 추가 기능이 관리자 경로에서 동작한다.
- [ ] 일반 사용자 API·DB 직접 접근으로 내부 메모와 관리자 활동을 읽을 수 없다.
- [ ] 예약 수집 장애가 수동 수집 성공으로 가려지지 않는다.
- [ ] 재시도가 실패한 단지·월만 처리하고 이력이 원본과 연결된다.
- [ ] 사용자 정보와 연동 상태는 허용 필드만 제공한다.
- [ ] 기술적 상세 오류는 서버 로그에서 추적 ID로 찾을 수 있다.
- [ ] 운영 데이터 초기화 없이 마이그레이션으로 배포할 수 있다.

## 문서 검토 결과

요청한 관리자 홈, 실패 재시도, 내부 메모, 사용자 조회, 관리자 활동 기록, 연동 점검을 모두 작업에 매핑했다. 활동 시각 정의, 예약·수동 실행 구분, 재시도 대상과 권한을 명시했다. 현재는 계획만 작성한 상태이며 모든 구현·검증 체크박스는 미완료로 남긴다.
