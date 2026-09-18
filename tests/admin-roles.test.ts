import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { roleError, socialProvider, validUserId } from "../lib/admin-roles";
test("role helpers validate ids, social providers and safe errors", () => {
  assert.equal(validUserId("123e4567-e89b-42d3-a456-426614174000"), true);
  assert.equal(validUserId("bad"), false);
  assert.equal(socialProvider({ app_metadata: { provider: "google" } }), "google");
  assert.equal(socialProvider({ app_metadata: { provider: "email" } }), "other");
  assert.deepEqual(roleError("ALREADY_ADMIN"), {
    status: 409,
    error: "이 사용자는 이미 관리자입니다.",
  });
  assert.equal(roleError("database exploded"), null);
});
test("super admin RPC receives the authenticated user session", () => {
  const source = readFileSync(join(import.meta.dirname, "..", "lib", "admin-server.ts"), "utf8");
  assert.match(source, /session\.auth\.schema\(["']admin["']\)\.rpc\(["']is_super_admin["']\)/);
});
