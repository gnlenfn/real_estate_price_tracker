import { test } from "node:test";
import assert from "node:assert/strict";
import { filterRecords } from "../lib/record-filter";
import type { Data } from "../lib/model";

const data: Data = {
  properties: [
    {
      id: "home",
      name: "고요한 집",
      district: "11110",
      dong: "청운동",
      area: 59,
      owned: true,
      color: "#000",
    },
    {
      id: "watch",
      name: "푸른 아파트",
      district: "11110",
      dong: "청운동",
      area: 84,
      owned: false,
      color: "#00f",
    },
  ],
  records: [
    {
      id: "1",
      property_id: "home",
      date: "2026-09-01",
      price: 100000,
      kind: "estimate",
      source: "직접 입력",
      note: "남향",
    },
    {
      id: "2",
      property_id: "watch",
      date: "2026-08-10",
      price: 150000,
      kind: "trade",
      source: "국토교통부 API",
      note: "12층",
    },
    {
      id: "3",
      property_id: "watch",
      date: "2024-01-10",
      price: 130000,
      kind: "trade",
      source: "국토교통부 API",
      note: "저층",
    },
    {
      id: "4",
      property_id: "home",
      date: "2026-07-01",
      price: 99000,
      kind: "trade",
      source: "직접 입력",
      note: "푸른 조망",
    },
  ],
};

test("record filters combine kind, property, period and normalized text search", () => {
  assert.deepEqual(
    filterRecords(data, {
      kind: "trade",
      propertyId: "watch",
      query: "  국토  ",
      years: 1,
      now: new Date("2026-09-13T00:00:00Z"),
    }).map((r) => r.id),
    ["2"],
  );
  assert.deepEqual(
    filterRecords(data, {
      kind: "trade",
      propertyId: "all",
      query: "푸른",
      years: null,
      now: new Date("2026-09-13T00:00:00Z"),
    }).map((r) => r.id),
    ["2", "4", "3"],
  );
});

test("record filters sort newest first and include the exact period boundary", () => {
  const boundary: Data = {
    ...data,
    records: [
      ...data.records,
      {
        id: "5",
        property_id: "watch",
        date: "2025-09-13",
        price: 140000,
        kind: "trade",
        source: "직접 입력",
        note: "",
      },
    ],
  };
  assert.deepEqual(
    filterRecords(boundary, {
      kind: "trade",
      propertyId: "all",
      query: "",
      years: 1,
      now: new Date("2026-09-13T00:00:00Z"),
    }).map((r) => r.id),
    ["2", "4", "5"],
  );
});

test("record filters limit records to the chosen legal district", () => {
  const regional: Data = {
    ...data,
    properties: [
      ...data.properties,
      {
        id: "outside",
        name: "다른 지역 아파트",
        district: "11680",
        dong: "역삼동",
        area: 84,
        owned: false,
        color: "#f00",
      },
    ],
    records: [
      ...data.records,
      {
        id: "outside-record",
        property_id: "outside",
        date: "2026-09-03",
        price: 200000,
        kind: "trade",
        source: "직접 입력",
        note: "",
      },
    ],
  };
  assert.deepEqual(
    filterRecords(regional, {
      kind: "trade",
      propertyId: "all",
      query: "",
      years: null,
      regionId: "11110",
    }).map((r) => r.id),
    ["2", "4", "3"],
  );
});
