import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_BULK_TRADE_JOBS,
  assertBulkTradeWorkload,
  bulkTradeLabel,
  executeBulkTradeReload,
  reconcileSelectedPropertyIds,
  selectableBulkProperties,
  toggleSelectedPropertyId,
} from "../lib/bulk-trade";
import type { Property } from "../lib/model";

const properties: Property[] = [
  {
    id: "home",
    name: "보유 주택",
    district: "11440",
    dong: "아현동",
    area: 84,
    owned: true,
    color: "#000",
  },
  {
    id: "b",
    name: "나중 단지",
    district: "11440",
    dong: "아현동",
    area: 84,
    owned: false,
    color: "#111",
  },
  {
    id: "a",
    name: "가까운 단지",
    district: "11440",
    dong: "아현동",
    area: 84,
    owned: false,
    color: "#222",
  },
  {
    id: "c",
    name: "다른 지역 단지",
    district: "11680",
    dong: "역삼동",
    area: 84,
    owned: false,
    color: "#333",
  },
];

test("bulk selection includes every visible owned and interest property", () => {
  assert.deepEqual(
    selectableBulkProperties(properties, "11440").map((property) => property.id),
    ["a", "b", "home"],
  );
  assert.deepEqual(
    selectableBulkProperties(properties, "all").map((property) => property.id),
    ["a", "b", "c", "home"],
  );
});

test("bulk progress label reports selected properties and months", () => {
  assert.equal(bulkTradeLabel(properties.slice(1, 3), ["2025-01", "2025-02"]), "2곳 · 2개월");
});

test("selection toggles and drops hidden and missing properties while keeping owned property", () => {
  assert.deepEqual(toggleSelectedPropertyId(["a"], "b"), ["a", "b"]);
  assert.deepEqual(toggleSelectedPropertyId(["a", "b"], "a"), ["b"]);
  assert.deepEqual(
    reconcileSelectedPropertyIds(properties, "11440", ["home", "a", "c", "missing"]),
    ["a", "home"],
  );
});

test("bulk workload rejects excessive property-month combinations", () => {
  assert.equal(assertBulkTradeWorkload(properties.slice(1, 3), ["2026-08", "2026-09"]), 4);
  assert.throws(
    () =>
      assertBulkTradeWorkload(
        properties.slice(1, 3),
        Array(MAX_BULK_TRADE_JOBS / 2 + 1).fill("2026-09"),
      ),
    /한 번에 조회할 수 있는 범위/,
  );
});

test("bulk reload sends every selected property-month pair before refresh", async () => {
  const events: string[] = [],
    selected = properties.slice(1, 3),
    months = ["2026-08", "2026-09"];
  const results = await executeBulkTradeReload({
    properties: selected,
    months,
    request: async (id, month) => {
      events.push(`${id}:${month}`);
      return 1;
    },
    progress: () => {},
    active: () => true,
    refresh: async () => {
      events.push("refresh");
    },
  });
  assert.deepEqual(
    new Set(events.slice(0, -1)),
    new Set(["b:2026-08", "b:2026-09", "a:2026-08", "a:2026-09"]),
  );
  assert.equal(events.at(-1), "refresh");
  assert.equal(
    results.reduce((count, result) => count + result.count, 0),
    4,
  );
});
