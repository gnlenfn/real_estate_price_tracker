# Bulk Trade Period Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관심단지를 체크박스로 여러 개 선택하고 하나의 월 범위로 실거래 기록을 추가 저장한다.

**Architecture:** 단지 목록에 선택 상태를 두고 현재 지역 필터의 관심단지만 대상으로 삼는다. 별도 일괄 조회 다이얼로그에서 월 범위를 검증한 뒤 기존 `runTradeSync`와 `/api/trades` 요청을 여러 단지에 재사용하고, 완료 후 `refresh`로 저장 결과를 반영한다.

**Tech Stack:** Next.js App Router, React client component, TypeScript, Supabase, existing `MonthPicker`, `runTradeSync`, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-16-bulk-trade-period-design.md`

## Global Constraints

- 대상은 `owned === false`인 관심단지만이다.
- 지역 필터가 적용된 상태에서는 현재 보이는 관심단지만 일괄 선택 대상이다.
- 기존 `syncMonths`의 월 범위 검증과 `runTradeSync`의 동시성 제한·부분 실패 집계를 재사용한다.
- 한국 시간의 현재 월 이후는 거부하고, 단지×개월 작업 수는 한 번에 1,200건으로 제한한다.
- 클라우드 로그인 상태에서만 실거래 API를 호출한다. 데모·로컬 모드에서는 로그인 안내를 표시한다.
- 기존 기록과 같은 단지·월을 다시 조회해도 저장 계층의 upsert 정책으로 중복을 만들지 않는다.

### Task 1: Selection and bulk-sync pure helpers

**Files:**
- Create: `lib/bulk-trade.ts`
- Test: `tests/bulk-trade.test.ts`

**Interfaces:**
- `selectableBulkProperties(properties: Property[], regionId: string): Property[]` returns all properties in the selected district, sorted by Korean name.
- `bulkTradeLabel(selected: Property[], months: string[]): string` returns a progress label containing selected property count and month count.

- [ ] **Step 1: Write failing tests**

```ts
const properties: Property[] = [
  { id: 'home', name: '보유 주택', district: '11440', dong: '아현동', area: 84, owned: true, color: '#000' },
  { id: 'b', name: '나중 단지', district: '11440', dong: '아현동', area: 84, owned: false, color: '#111' },
  { id: 'a', name: '가까운 단지', district: '11440', dong: '아현동', area: 84, owned: false, color: '#222' },
  { id: 'c', name: '다른 지역 단지', district: '11680', dong: '역삼동', area: 84, owned: false, color: '#333' },
];

test('bulk selection only includes visible interest properties', () => {
  assert.deepEqual(selectableBulkProperties(properties, '11440').map(p => p.id), ['a', 'b', 'home']);
  assert.deepEqual(selectableBulkProperties(properties, 'all').map(p => p.id), ['a', 'b', 'c', 'home']);
});

test('bulk progress label reports selected properties and months', () => {
  assert.equal(bulkTradeLabel(properties.slice(0, 2), ['2025-01', '2025-02']), '2곳 · 2개월');
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx tsx --test tests/bulk-trade.test.ts`

Expected: FAIL because `lib/bulk-trade.ts` does not exist.

- [ ] **Step 3: Implement the minimal helpers**

Implement the two exported functions using `Property.owned`, `Property.district`, `localeCompare(..., 'ko')`, and `months.length`; do not add a second sorting or sync implementation.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npx tsx --test tests/bulk-trade.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/bulk-trade.ts tests/bulk-trade.test.ts
git commit -m "feat: add bulk trade selection helpers"
```

### Task 2: Add multi-property reload action to the property list

**Files:**
- Modify: `app/page.tsx` (property selection state, bulk reload handler, property-list header and rows)
- Modify: `app/globals.css` (selection toolbar and checkbox layout)
- Test: `tests/record-trade-reload.test.ts`

**Interfaces:**
- Consumes `selectableBulkProperties`, `syncMonths`, `runTradeSync`, `MonthPicker`, and the existing `refresh`/session state.
- Produces `selectedPropertyIds: string[]`, `bulkTradeModal: boolean`, and a property-list action that opens the bulk dialog for selected interest properties.

- [ ] **Step 1: Write failing integration assertions**

Extend the existing source-level regression test to assert the page contains `전체 선택`, `전체 다시 조회`, `가격 조회`, `selectedPropertyIds`, and a `bulkTradeModal` branch while preserving `reloadTrades`, `syncMonths`, and `runTradeSync`.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx tsx --test tests/record-trade-reload.test.ts`

Expected: FAIL because the property page has no bulk selection controls or state.

- [ ] **Step 3: Implement selection state and actions**

Add state for selected IDs and a bulk modal. Derive selectable properties from `visibleProperties` with the helper. Implement:

```ts
const selectableProperties = selectableBulkProperties(data.properties, regionId)
const selectedProperties = selectableProperties.filter(p => selectedPropertyIds.includes(p.id))
function togglePropertySelection(id: string): void
function toggleAllVisibleProperties(): void
function openBulkTradeReload(): void
```

When the region changes or properties are deleted, remove IDs that are no longer selectable. Disable selection controls while `busy`.

- [ ] **Step 4: Add the property-list toolbar and row checkboxes**

Render a checkbox only for `!p.owned`. Show `전체 선택` when not all visible interest properties are selected; show `선택 해제` when selected. Disable the bulk action with no selection and include the selected count in its label.

- [ ] **Step 5: Run the focused test and verify it passes**

Run: `npx tsx --test tests/record-trade-reload.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/globals.css tests/record-trade-reload.test.ts
git commit -m "feat: select interest properties for bulk reload"
```

### Task 3: Implement the bulk period dialog and sync flow

**Files:**
- Modify: `app/page.tsx` (bulk dialog and `runTradeSync` request loop)
- Modify: `app/globals.css` (dialog progress/summary styling)
- Test: `tests/record-trade-reload.test.ts`

**Interfaces:**
- Consumes `selectedProperties`, `syncMonths`, and `runTradeSync` from Tasks 1–2.
- Produces a bulk form with `MonthPicker` fields named `bulk-start` and `bulk-end`, and a save path that refreshes all fetched records.

- [ ] **Step 1: Write failing assertions for the bulk flow**

Assert the page source contains the two bulk month fields, the cloud-only guard, a `runTradeSync(selectedProperties` call, and `setSelectedPropertyIds([])` after a completed refresh.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx tsx --test tests/record-trade-reload.test.ts`

Expected: FAIL because the bulk dialog and multi-property request path are absent.

- [ ] **Step 3: Implement validation and request flow**

On submit, call `syncMonths(start, end)`, reject an empty selection, require cloud mode/session, and call `runTradeSync(selectedProperties, months, request, setMessage, account guard)`. The request callback should mirror `reloadTrades`: refresh the current session token, POST `{propertyId, month}` to `/api/trades`, handle non-OK errors, and return `result.count`. After `refresh`, clear selected IDs and close the dialog only when the active account remains unchanged.

- [ ] **Step 4: Show partial results and local-mode guidance**

Keep `syncSummary(results)` in the existing message area so successes, zero-result months, and failures are visible. In demo/local mode, show the existing login-required notice and disable the submit button without making a network request.

- [ ] **Step 5: Run the focused and full tests**

Run: `npx tsx --test tests/record-trade-reload.test.ts`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 6: Run the production build**

Run: `npm run build`

Expected: Next.js compilation and TypeScript checks PASS.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx app/globals.css tests/record-trade-reload.test.ts
git commit -m "feat: bulk reload additional trade periods"
```
