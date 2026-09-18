import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const source = (path: string) => readFileSync(join(root, path), "utf8");

test("browser Supabase client defaults database requests to the app schema", () => {
  assert.match(source("lib/supabase.ts"), /db:\s*\{\s*schema:\s*["']app["']\s*\}/);
});

test("application code routes support and admin relations through their schemas", () => {
  const files = [
    "app/components/support-inbox.tsx",
    "app/api/support/route.ts",
    "app/api/support/[ticketId]/messages/route.ts",
    "app/api/admin/overview/route.ts",
    "app/api/admin/support/route.ts",
    "app/api/admin/support/[ticketId]/route.ts",
    "app/api/admin/support/[ticketId]/github/route.ts",
    "app/api/admin/support/[ticketId]/notes/route.ts",
    "app/api/admin/activity/route.ts",
    "app/api/admin/users/route.ts",
    "app/api/admin/integrations/route.ts",
    "app/api/admin/integrations/[service]/check/route.ts",
    "app/api/admin/sync/route.ts",
    "app/api/admin/sync/[runId]/route.ts",
    "lib/admin-server.ts",
    "lib/support-server.ts",
    "lib/admin-audit.ts",
    "lib/weekly-sync-server.ts",
  ];
  const combined = files.map((path) => source(path)).join("\n");
  for (const legacy of [
    "support_tickets",
    "support_messages",
    "support_attachments",
    "support_internal_notes",
    "support_github_message_exports",
    "app_admins",
    "admin_audit_events",
    "admin_list_users",
    "admin_list_support_tickets",
  ]) {
    assert.doesNotMatch(
      combined,
      new RegExp(`['"]${legacy}['"]`),
      `legacy Supabase identifier remains: ${legacy}`,
    );
  }
  assert.match(combined, /\.schema\(["']support["']\)/);
  assert.match(combined, /\.schema\(["']admin["']\)/);
});
