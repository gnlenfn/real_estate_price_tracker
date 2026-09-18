import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PriceScenarios } from "../app/components/price-scenarios";
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

test("the current column emphasizes the gap and lists both current prices", () => {
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
        id: "watch",
        name: "관심단지",
        district: "11440",
        dong: "공덕동",
        area: 84,
        owned: false,
        color: "#12a18b",
        road_address: "서울특별시 마포구 마포대로 2",
      },
    ],
    records: [
      {
        id: "home-price",
        property_id: "home",
        date: "2026-09-01",
        price: 100000,
        kind: "estimate",
        source: "test",
        note: "",
      },
      {
        id: "watch-price",
        property_id: "watch",
        date: "2026-09-01",
        price: 150000,
        kind: "trade",
        source: "test",
        note: "",
      },
    ],
  };

  const markup = renderToStaticMarkup(
    createElement(PriceScenarios, {
      data,
      baseId: "home",
      baseKind: "estimate",
      regionId: "all",
      onBaseChange: () => undefined,
      onRegionChange: () => undefined,
    }),
  );

  assert.match(
    markup,
    /class="scenario-current-cell"><strong>\+5억<\/strong><span>관심 15억<\/span><span>내 집 10억<\/span>/,
  );
});
