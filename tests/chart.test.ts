import { test } from "node:test";
import assert from "node:assert/strict";
import { series, chartAvailability, Data } from "../lib/model";
const properties: Data["properties"] = [
  {
    id: "home",
    name: "보유 빌라",
    district: "11440",
    dong: "아현동",
    area: 36,
    owned: true,
    color: "#000",
  },
  {
    id: "watch",
    name: "관심 아파트",
    district: "11440",
    dong: "아현동",
    area: 84,
    owned: false,
    color: "#00f",
  },
];
const record = {
  id: "1",
  property_id: "home",
  date: "2026-09-01",
  price: 76000,
  kind: "estimate" as const,
  source: "직접 입력",
  note: "",
};
const data: Data = {
  properties,
  records: [
    record,
    { ...record, id: "2", property_id: "watch", kind: "trade", price: 150000 },
    { ...record, id: "3", property_id: "watch", kind: "estimate", price: 999999 },
  ],
};
test("explicit separate price bases compare home estimates with apartment trades without mixing medians", () => {
  const rows = series(data, "home", "trade", 2, new Date("2026-09-12"), "estimate");
  assert.equal(rows[1].home, 76000);
  assert.equal(rows[1].watch, 150000);
  assert.equal(rows[1].gap_watch, 74000);
  assert.equal(rows[0].home, null);
  assert.equal(rows[0].gap_watch, null);
  assert.equal(chartAvailability(data, rows, "home", "trade", "estimate", "gap"), null);
});
test("records in different months compare at the next price event using each latest value", () => {
  const nonoverlap: Data = {
    properties,
    records: [
      record,
      {
        ...record,
        id: "2",
        property_id: "watch",
        kind: "trade",
        date: "2026-08-01",
        price: 150000,
      },
    ],
  };
  const rows = series(nonoverlap, "home", "trade", 2, new Date("2026-09-12"), "estimate");
  assert.equal(rows[1].gap_watch, 74000);
  assert.equal(rows[1].gap_base_month_watch, "2026-09");
  assert.equal(rows[1].gap_target_month_watch, "2026-08");
  assert.equal(chartAvailability(nonoverlap, rows, "home", "trade", "estimate", "gap"), null);
  assert.equal(chartAvailability(nonoverlap, rows, "home", "trade", "estimate", "price"), null);
});
test("a value before the selected range seeds later comparisons without appearing on the price line", () => {
  const seeded: Data = {
    properties,
    records: [
      { ...record, date: "2025-09-01" },
      {
        ...record,
        id: "2",
        property_id: "watch",
        kind: "trade",
        date: "2026-01-01",
        price: 150000,
      },
    ],
  };
  const rows = series(seeded, "home", "trade", 2, new Date("2026-02-12"), "estimate");
  assert.equal(rows[0].home, null);
  assert.equal(rows[0].gap_watch, 74000);
  assert.equal(rows[0].gap_base_month_watch, "2025-09");
  assert.equal(rows[0].gap_target_month_watch, "2026-01");
});
test("missing chosen kind is explained even when other records exist", () => {
  const rows = series(data, "home", "asking", 2, new Date("2026-09-12"));
  assert.match(
    chartAvailability(data, rows, "home", "asking", "asking", "gap")!,
    /호가 기록이 없습니다/,
  );
});

test("chart availability only considers the selected comparison properties", () => {
  const selected: Data = {
    properties: [
      { ...properties[0] },
      { ...properties[1], id: "hidden", name: "숨긴 관심 단지" },
      { ...properties[1], id: "shown", name: "표시할 관심 단지" },
    ],
    records: [
      record,
      { ...record, id: "hidden-trade", property_id: "hidden", kind: "trade", price: 150000 },
    ],
  };
  const rows = series(selected, "home", "trade", 2, new Date("2026-09-12"), "estimate");
  assert.match(
    chartAvailability(selected, rows, "home", "trade", "estimate", "gap", ["shown"])!,
    /가격 변화가 없습니다/,
  );
});

test("weekly series uses Monday boundaries, weekly medians, and latest known values for gaps", () => {
  const weekly: Data = {
    properties,
    records: [
      { ...record, id: "h0", date: "2026-08-21", price: 70000 },
      { ...record, id: "h1", date: "2026-08-31", price: 76000 },
      { ...record, id: "h2", date: "2026-09-02", price: 78000 },
      {
        ...record,
        id: "w1",
        property_id: "watch",
        kind: "trade",
        date: "2026-09-04",
        price: 150000,
      },
      {
        ...record,
        id: "w2",
        property_id: "watch",
        kind: "trade",
        date: "2026-09-08",
        price: 154000,
      },
    ],
  };
  const rows = series(
    weekly,
    "home",
    "trade",
    3,
    new Date("2026-09-09T12:00:00Z"),
    "estimate",
    "week",
  );
  assert.deepEqual(
    rows.map((row) => row.month),
    ["2026-08-24", "2026-08-31", "2026-09-07"],
  );
  assert.deepEqual(
    rows.map((row) => row.label),
    ["08.24", "08.31", "09.07"],
  );
  assert.equal(rows[0].home, null);
  assert.equal(rows[1].home, 77000);
  assert.equal(rows[1].watch, 150000);
  assert.equal(rows[1].gap_watch, 73000);
  assert.equal(rows[2].home, null);
  assert.equal(rows[2].watch, 154000);
  assert.equal(rows[2].gap_watch, 77000);
  assert.equal(rows[2].gap_base_month_watch, "2026-08-31");
  assert.equal(rows[2].gap_target_month_watch, "2026-09-07");
});
