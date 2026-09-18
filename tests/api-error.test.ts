import { test } from "node:test";
import assert from "node:assert/strict";
import { publicErrorBody, sanitizeLogValue } from "../lib/api-error";

test("public errors contain a safe message and request id only", () => {
  const body = publicErrorBody("잠시 후 다시 시도해 주세요.", "request-123");
  assert.deepEqual(body, { error: "잠시 후 다시 시도해 주세요.", requestId: "request-123" });
  assert.doesNotMatch(JSON.stringify(body), /SUPABASE|secret|postgres/i);
});

test("server log values redact bearer tokens, keys, emails, and UUIDs", () => {
  const value = sanitizeLogValue(
    "Bearer abc.def.ghi api_key=topsecret user@example.com 123e4567-e89b-12d3-a456-426614174000",
  );
  assert.doesNotMatch(
    value,
    /abc\.def\.ghi|topsecret|user@example\.com|123e4567-e89b-12d3-a456-426614174000/,
  );
});
