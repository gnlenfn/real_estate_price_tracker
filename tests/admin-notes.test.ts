import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAdminNote } from "../lib/admin-notes";

test("admin notes accept 1 through 4000 trimmed characters", () => {
  assert.equal(validateAdminNote("  확인 필요  "), null);
  assert.ok(validateAdminNote("   "));
  assert.ok(validateAdminNote("가".repeat(4001)));
});
