import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveSyncHealth, safeSyncFailures } from "../lib/sync-status";

test("sync health detects missing, stale, and stuck weekly runs", () => {
  const now = new Date("2026-09-13T12:00:00Z");
  assert.equal(deriveSyncHealth(null, now), "delayed");
  assert.equal(
    deriveSyncHealth(
      {
        status: "success",
        started_at: "2026-09-01T00:00:00Z",
        finished_at: "2026-09-01T00:01:00Z",
      },
      now,
    ),
    "delayed",
  );
  assert.equal(
    deriveSyncHealth(
      { status: "running", started_at: "2026-09-13T10:00:00Z", finished_at: null },
      now,
    ),
    "delayed",
  );
  assert.equal(
    deriveSyncHealth(
      {
        status: "partial",
        started_at: "2026-09-13T11:59:00Z",
        finished_at: "2026-09-13T12:00:00Z",
      },
      now,
    ),
    "partial",
  );
});

test("stored sync failures exclude provider error messages", () => {
  assert.deepEqual(
    safeSyncFailures([
      {
        propertyId: "p1",
        name: "푸른마을",
        month: "2026-09",
        message: "API key invalid at provider",
      },
    ]),
    [{ propertyId: "p1", name: "푸른마을", month: "2026-09" }],
  );
});
