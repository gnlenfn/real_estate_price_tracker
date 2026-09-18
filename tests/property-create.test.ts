import { test } from "node:test";
import assert from "node:assert/strict";
import { tradeMonthsForNewProperty } from "../lib/property-create";

test("new property uses every selected month for its initial trade lookup", () => {
  assert.deepEqual(tradeMonthsForNewProperty(false, "2026-01", "2026-03", "2026-09"), [
    "2026-01",
    "2026-02",
    "2026-03",
  ]);
});

test("editing a property does not trigger an initial trade lookup", () => {
  assert.deepEqual(tradeMonthsForNewProperty(true, "2026-01", "2026-03", "2026-09"), []);
});

test("initial trade lookup rejects future end months", () => {
  assert.throws(() => tradeMonthsForNewProperty(false, "2026-01", "2026-10", "2026-09"), /이번 달/);
});
