import { test } from "node:test";
import assert from "node:assert/strict";
import { providerAvailability, oauthCallbackError, authError } from "../lib/auth";
test("only explicitly enabled Google and Kakao providers are available", () => {
  assert.deepEqual(
    providerAvailability({ external: { google: true, kakao: false, email: true } }),
    { google: true, kakao: false },
  );
  assert.deepEqual(providerAvailability({ external: { google: "true", kakao: 1 } }), {
    google: false,
    kakao: false,
  });
  assert.deepEqual(providerAvailability(null), { google: false, kakao: false });
});
test("OAuth failure callbacks handle fragments and query errors without exposing supplied descriptions", () => {
  assert.match(
    oauthCallbackError("", "#error=access_denied&error_description=private-token")!,
    /취소/,
  );
  assert.match(oauthCallbackError("?error_code=bad_oauth_state", "")!, /만료/);
  assert.equal(oauthCallbackError("?mode=callback", "#access_token=example"), null);
  assert.equal(
    oauthCallbackError("?error=unknown&error_description=private-token", "")?.includes(
      "private-token",
    ),
    false,
  );
});
test("provider configuration, throttling and session failures have actionable messages", () => {
  assert.match(authError({ code: "provider_disabled" }), /현재 이용할 수 없습니다/);
  assert.match(authError({ status: 429 }), /잠시 후/);
  assert.match(authError({ code: "session_not_found" }), /다시 로그인/);
});

test("configuration failures stay generic and diagnostics are restricted to development", () => {
  const original = process.env.NODE_ENV;
  const messages: unknown[][] = [];
  const originalDebug = console.debug;
  console.debug = (...args: unknown[]) => {
    messages.push(args);
  };
  try {
    Reflect.set(process.env, "NODE_ENV", "production");
    for (const message of [
      "Error getting user email from external provider",
      "Unable to exchange external code: secret-value",
      "Error getting user profile",
      "Database error saving new user",
    ]) {
      const result = authError({ details: { code: "unexpected_failure" }, message });
      assert.match(result, /잠시 후 다시 시도/);
      assert.doesNotMatch(result, /AUTH_|Supabase|Secret|secret-value/);
    }
    assert.equal(messages.length, 0);
    Reflect.set(process.env, "NODE_ENV", "development");
    const result = oauthCallbackError(
      "?error_code=unexpected_failure&error_description=Error+getting+user+email+from+external+provider",
      "",
    );
    assert.doesNotMatch(result!, /AUTH_|Supabase/);
    assert.deepEqual(messages, [["[auth]", "AUTH_EMAIL_REQUIRED"]]);
    authError({ message: "Unable to exchange external code: secret-value" });
    assert.deepEqual(messages[1], ["[auth]", "AUTH_TOKEN_EXCHANGE"]);
  } finally {
    if (original === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Reflect.set(process.env, "NODE_ENV", original);
    console.debug = originalDebug;
  }
});
