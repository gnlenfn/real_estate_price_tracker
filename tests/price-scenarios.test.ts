import assert from "node:assert/strict";
import { test } from "node:test";
import type { Data } from "../lib/model";
import {
  latestMonthlyMedianPrice,
  priceScenario,
} from "../lib/price-scenarios";

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
});

test("current price uses the latest month median for the selected price kind", () => {
  const data: Data = {
    properties: [],
    records: [
      { id: "old", property_id: "watch", date: "2026-08-10", price: 130000, kind: "trade", source: "test", note: "" },
      { id: "a", property_id: "watch", date: "2026-09-03", price: 150000, kind: "trade", source: "test", note: "" },
      { id: "b", property_id: "watch", date: "2026-09-20", price: 170000, kind: "trade", source: "test", note: "" },
      { id: "estimate", property_id: "watch", date: "2026-10-01", price: 999000, kind: "estimate", source: "test", note: "" },
    ],
  };

  assert.deepEqual(latestMonthlyMedianPrice(data, "watch", "trade"), {
    month: "2026-09",
    price: 160000,
  });
});
