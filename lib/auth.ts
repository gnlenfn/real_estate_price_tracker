export type SocialProvider = "google" | "kakao";
export type ProviderAvailability = Record<SocialProvider, boolean>;
export function providerAvailability(settings: unknown): ProviderAvailability {
  const external = (settings as { external?: Record<string, unknown> } | null)?.external;
  return { google: external?.google === true, kakao: external?.kakao === true };
}
export function oauthCallbackError(search: string, hash: string): string | null {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const code =
    query.get("error_code") ||
    fragment.get("error_code") ||
    query.get("error") ||
    fragment.get("error");
  if (!code) return null;
  return authError({
    code,
    message: query.get("error_description") || fragment.get("error_description") || "",
  });
}
type AuthFailure = {
  code?: string;
  status?: number;
  message?: string;
  details?: { code?: string; error?: string } | null;
};
function diagnosticCategory(error: AuthFailure) {
  const description = error.message || "";
  if (/Error getting user email from external provider/i.test(description))
    return "AUTH_EMAIL_REQUIRED";
  if (
    /Unable to exchange external code|Error exchanging code|invalid_client|KOE010|KOE320/i.test(
      description,
    )
  )
    return "AUTH_TOKEN_EXCHANGE";
  if (/Unable to fetch user profile|Error getting user profile/i.test(description))
    return "AUTH_PROFILE";
  if (/Database error saving new user/i.test(description)) return "AUTH_USER_SAVE";
  const code = error.code || error.details?.code || error.details?.error;
  if (code === "unexpected_failure" || code === "server_error") return "AUTH_PROVIDER_FAILURE";
  return "AUTH_UNKNOWN";
}
export function authError(error: AuthFailure) {
  // Only a fixed diagnostic category is logged locally; never raw OAuth data.
  if (process.env.NODE_ENV === "development") console.debug("[auth]", diagnosticCategory(error));
  const code = error.code || error.details?.code || error.details?.error;
  if (error.status === 429 || code?.includes("rate_limit"))
    return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  switch (code) {
    case "access_denied":
      return "로그인이 취소되었거나 동의가 완료되지 않았습니다. 다시 시도해 주세요.";
    case "provider_disabled":
    case "validation_failed":
      return "이 로그인 서비스를 현재 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.";
    case "signup_disabled":
      return "현재 신규 가입이 열려 있지 않습니다. 운영자에게 문의해 주세요.";
    case "bad_oauth_callback":
    case "bad_oauth_state":
    case "flow_state_expired":
      return "로그인 요청이 만료되었거나 유효하지 않습니다. 다시 시작해 주세요.";
    case "session_not_found":
    case "refresh_token_not_found":
      return "로그인이 만료되었습니다. 다시 로그인해 주세요.";
    default:
      return "로그인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
}
