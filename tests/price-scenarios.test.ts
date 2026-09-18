import assert from "node:assert/strict";
import { test } from "node:test";
import type { Data } from "../lib/model";
import { latestMonthlyMedianPrice, priceScenario, scenarioGroups } from "../lib/price-scenarios";

test("a scenario applies the same rate to the owned and interest prices", () => {
  assert.deepEqual(priceScenario(100000, 150000, -30), {
    rate: -30,
    basePrice: 70000,
    targetPrice: 105000,
    gap: 35000,
  });
  assert.deepEqual(priceScenario(100000, 150000, 30), {
    rate: 30,
    basePrice: 130000,
    targetPrice: 195000,
    gap: 65000,
  });
  assert.deepEqual(priceScenario(100000, 150000, 0), {
    rate: 0,
    basePrice: 100000,
    targetPrice: 150000,
    gap: 50000,
  });
});

test("current price uses the latest month median for the selected price kind", () => {
  const data: Data = {
    properties: [],
    records: [
      {
        id: "old",
        property_id: "watch",
        date: "2026-08-10",
        price: 130000,
        kind: "trade",
        source: "test",
        note: "",
      },
      {
        id: "a",
        property_id: "watch",
        date: "2026-09-03",
        price: 150000,
        kind: "trade",
        source: "test",
        note: "",
      },
      {
        id: "b",
        property_id: "watch",
        date: "2026-09-20",
        price: 170000,
        kind: "trade",
        source: "test",
        note: "",
      },
      {
        id: "estimate",
        property_id: "watch",
        date: "2026-10-01",
        price: 999000,
        kind: "estimate",
        source: "test",
        note: "",
      },
    ],
  };

  assert.deepEqual(latestMonthlyMedianPrice(data, "watch", "trade"), {
    month: "2026-09",
    price: 160000,
  });
});

test("scenario groups filter, sort, and attach each interest property's latest trade", () => {
  const data: Data = {
    properties: [
      {
        id: "home",
        name: "내 집",
        district: "11440",
        dong: "아현동",
        area: 84,
        owned: true,
        color: "#285ee8",
        road_address: "서울특별시 마포구 마포대로 1",
      },
      {
        id: "z",
        name: "자이",
        district: "11440",
        dong: "공덕동",
        area: 59,
        owned: false,
        color: "#12a18b",
        road_address: "서울특별시 마포구 마포대로 2",
      },
      {
        id: "a-small",
        name: "래미안",
        district: "11440",
        dong: "공덕동",
        area: 59,
        owned: false,
        color: "#12a18b",
        road_address: "서울특별시 마포구 마포대로 3",
      },
      {
        id: "a-large",
        name: "래미안",
        district: "11440",
        dong: "공덕동",
        area: 84,
        owned: false,
        color: "#12a18b",
        road_address: "서울특별시 마포구 마포대로 3",
      },
    ],
    records: [
      {
        id: "z-old",
        property_id: "z",
        date: "2026-08-01",
        price: 90000,
        kind: "trade",
        source: "test",
        note: "",
      },
      {
        id: "z-new",
        property_id: "z",
        date: "2026-09-01",
        price: 100000,
        kind: "trade",
        source: "test",
        note: "",
      },
      {
        id: "a-small",
        property_id: "a-small",
        date: "2026-09-01",
        price: 110000,
        kind: "trade",
        source: "test",
        note: "",
      },
      {
        id: "a-large",
        property_id: "a-large",
        date: "2026-09-01",
        price: 120000,
        kind: "trade",
        source: "test",
        note: "",
      },
    ],
  };

  assert.deepEqual(
    scenarioGroups(data, "home", "all").map((group) => ({
      label: group.label,
      rows: group.rows.map((row) => ({
        id: row.property.id,
        price: row.current?.price,
      })),
    })),
    [
      {
        label: "서울 마포구",
        rows: [
          { id: "a-small", price: 110000 },
          { id: "a-large", price: 120000 },
          { id: "z", price: 100000 },
        ],
      },
    ],
  );
});
