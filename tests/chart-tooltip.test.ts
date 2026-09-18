import assert from "node:assert/strict";
import { test } from "node:test";
import { descendingTooltipValueKey } from "../lib/chart-tooltip";

test("tooltip values are ordered from highest to lowest", () => {
  const entries = [
    { name: "낮은 값", value: -30000 },
    { name: "높은 값", value: 120000 },
    { name: "중간 값", value: 45000 },
  ];

  const sorted = entries.toSorted(
    (left, right) =>
      descendingTooltipValueKey(left) - descendingTooltipValueKey(right),
  );

  assert.deepEqual(
    sorted.map(({ name }) => name),
    ["높은 값", "중간 값", "낮은 값"],
  );
});
