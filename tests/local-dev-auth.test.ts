import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, ".."),
  source = (path: string) => readFileSync(join(root, path), "utf8");

test("local development login reuses a server-managed account", () => {
  const page = source("app/auth/page.tsx"),
    route = source("app/api/auth/local/route.ts"),
    adminPage = source("app/admin/login/page.tsx"),
    adminRoute = source("app/api/auth/local-admin/route.ts");
  assert.doesNotMatch(page, /signInAnonymously/);
  assert.match(page, /\/api\/auth\/local/);
  assert.match(route, /LOCAL_DEV_USER_EMAIL/);
  assert.match(route, /signInWithPassword/);
  assert.match(route, /isLocalSupabase/);
  assert.match(adminPage, /로컬 최고 관리자로 시작/);
  assert.match(adminRoute, /LOCAL_ADMIN_EMAIL/);
  assert.match(adminRoute, /role\s*:\s*["']super_admin["']/);
  assert.match(adminRoute, /signInWithPassword/);
});
