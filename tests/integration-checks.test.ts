import { test } from "node:test";
import assert from "node:assert/strict";
import { runExternalIntegrationCheck } from "../lib/integration-checks";

test("unconfigured integration performs no request", async () => {
  const requests: RequestInit[] = [];
  const result = await runExternalIntegrationCheck("kakao", {}, async (_url, init) => {
    requests.push(init || {});
    return new Response("{}");
  });
  assert.equal(result.status, "unconfigured");
  assert.equal(requests.length, 0);
});

test("GitHub health check uses a read-only request", async () => {
  const methods: string[] = [];
  const result = await runExternalIntegrationCheck(
    "github",
    { GITHUB_ISSUES_TOKEN: "token", GITHUB_ISSUES_REPOSITORY: "owner/repo" },
    async (_url, init) => {
      methods.push(init?.method || "GET");
      return new Response("{}", { status: 200 });
    },
  );
  assert.equal(result.status, "success");
  assert.deepEqual(methods, ["GET"]);
});
