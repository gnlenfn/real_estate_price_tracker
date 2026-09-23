import assert from "node:assert/strict";
import { test } from "node:test";
import { chartDomain } from "../lib/chart-scale";

test("chart domain adds enough space around the visible values", () => {
  assert.deepEqual(chartDomain([50000, 100000]), [44000, 106000]);
});

test("chart domain does not force zero into an all-positive range", () => {
  const domain = chartDomain([44500, null, 123000]);
  assert.ok(domain);
  assert.ok(domain[0] > 0);
});

test("chart domain keeps zero visible when the data crosses it", () => {
  const domain = chartDomain([-10000, 10000]);
  assert.ok(domain);
  assert.ok(domain[0] < 0 && domain[1] > 0);
});
