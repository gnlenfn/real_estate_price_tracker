import { test } from "node:test";
import assert from "node:assert/strict";
import {
  currentKoreaMonth,
  isTradeMonthAllowed,
  runTradeSync,
  syncMonths,
  syncSummary,
} from "../lib/trade-sync";
import { demoData } from "../lib/model";
test("sync spans year boundaries inclusively and rejects reversed months", () => {
  assert.deepEqual(syncMonths("2025-12", "2026-02"), ["2025-12", "2026-01", "2026-02"]);
  assert.throws(() => syncMonths("2026-02", "2026-01"));
  assert.throws(() => syncMonths("2026-00", "2026-02"));
});
test("sync rejects a month after the current Korea month", () => {
  const now = new Date(),
    korea = new Date(now.getTime() + 9 * 60 * 60 * 1000),
    year = korea.getUTCFullYear(),
    month = korea.getUTCMonth() + 1;
  const futureMonth =
    month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  assert.throws(() => syncMonths(futureMonth, futureMonth), /조회 기간/);
});
test("Korea month validation crosses the UTC month boundary consistently", () => {
  const koreaSeptember = new Date("2026-08-31T15:30:00.000Z");
  assert.equal(currentKoreaMonth(koreaSeptember), "2026-09");
  assert.equal(isTradeMonthAllowed("2026-09", koreaSeptember), true);
  assert.equal(isTradeMonthAllowed("2026-10", koreaSeptember), false);
});
test("bulk sync continues after a month failure and retains per-property results", async () => {
  const properties = demoData().properties.slice(0, 2),
    calls: string[] = [];
  const results = await runTradeSync(
    properties,
    ["2026-01", "2026-02"],
    async (id, month) => {
      calls.push(`${id}:${month}`);
      if (id === properties[0].id && month === "2026-01") throw new Error("일시 오류");
      return id === properties[0].id ? 0 : 3;
    },
    () => {},
  );
  assert.equal(calls.length, 4);
  assert.equal(results[0].completed, 1);
  assert.equal(results[0].count, 0);
  assert.deepEqual(results[0].failures, [{ month: "2026-01", message: "일시 오류" }]);
  assert.equal(results[1].count, 6);
  assert.equal(results[1].completed, 2);
  assert.match(syncSummary(results), /6건 반영/);
});
test("account change stops the remaining requests", async () => {
  let active = true,
    calls = 0;
  await assert.rejects(
    runTradeSync(
      demoData().properties.slice(0, 2),
      ["2026-01"],
      async () => {
        calls++;
        active = false;
        return 1;
      },
      () => {},
      () => active,
    ),
    /계정이 변경/,
  );
  assert.equal(calls, 1);
});

test("bulk requests overlap with a cap of ten and settle out of order without losing results", async () => {
  const properties = demoData().properties.slice(0, 2),
    months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
  let running = 0,
    peak = 0;
  const calls: string[] = [],
    pending: (() => void)[] = [],
    progress: string[] = [];
  const resultPromise = runTradeSync(
    properties,
    months,
    (id, month) =>
      new Promise<number>((resolve, reject) => {
        calls.push(`${id}:${month}`);
        running++;
        peak = Math.max(peak, running);
        pending.push(() => {
          running--;
          if (month === "2026-02") reject(new Error("일시 오류"));
          else resolve(2);
        });
      }),
    (label) => progress.push(label),
  );
  assert.equal(calls.length, 10);
  assert.equal(running, 10);
  while (pending.length) {
    pending.pop()!();
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  const results = await resultPromise;
  assert.equal(peak, 10);
  assert.equal(running, 0);
  assert.equal(new Set(calls).size, 12);
  for (const result of results) {
    assert.equal(result.count, 10);
    assert.equal(result.completed, 5);
    assert.equal(result.failures[0].month, "2026-02");
  }
  assert.equal(progress.at(-1), "12/12 완료 · 0건 조회 중…");
});
test("account change waits for in-flight work and does not schedule new jobs", async () => {
  let active = true,
    calls = 0;
  const pending: (() => void)[] = [];
  const operation = runTradeSync(
    demoData().properties,
    ["2026-01", "2026-02", "2026-03"],
    () =>
      new Promise<number>((resolve) => {
        calls++;
        pending.push(() => resolve(1));
      }),
    () => {},
    () => active,
  );
  assert.equal(calls, 10);
  active = false;
  pending.forEach((resolve) => resolve());
  await assert.rejects(operation, /계정이 변경/);
  assert.equal(calls, 10);
});
