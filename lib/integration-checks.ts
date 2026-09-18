export type IntegrationService = "supabase" | "molit" | "kakao" | "github";
type CheckStatus = "success" | "failed" | "unconfigured";
type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;
const required: Record<Exclude<IntegrationService, "supabase">, string[]> = {
  molit: ["MOLIT_API_KEY"],
  kakao: ["KAKAO_REST_API_KEY"],
  github: ["GITHUB_ISSUES_TOKEN", "GITHUB_ISSUES_REPOSITORY"],
};

export function integrationConfigured(
  service: IntegrationService,
  env: Record<string, string | undefined> = process.env,
) {
  return service === "supabase"
    ? Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SECRET_KEY)
    : required[service].every((key) => Boolean(env[key]));
}

export async function runExternalIntegrationCheck(
  service: Exclude<IntegrationService, "supabase">,
  env: Record<string, string | undefined> = process.env,
  fetcher: Fetcher = fetch,
): Promise<{ status: CheckStatus; checkedAt: string; requestId: string }> {
  const checkedAt = new Date().toISOString(),
    requestId = crypto.randomUUID();
  if (!integrationConfigured(service, env)) return { status: "unconfigured", checkedAt, requestId };
  try {
    let url: string,
      headers: HeadersInit = {};
    if (service === "github") {
      url = `https://api.github.com/repos/${env.GITHUB_ISSUES_REPOSITORY}/issues?state=all&per_page=1`;
      headers = {
        Authorization: `Bearer ${env.GITHUB_ISSUES_TOKEN}`,
        Accept: "application/vnd.github+json",
      };
    } else if (service === "kakao") {
      url =
        "https://dapi.kakao.com/v2/local/search/keyword.json?query=%EC%95%84%ED%8C%8C%ED%8A%B8&size=1";
      headers = { Authorization: `KakaoAK ${env.KAKAO_REST_API_KEY}` };
    } else {
      const month = new Date().toISOString().slice(0, 7).replace("-", "");
      url = `https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade?serviceKey=${encodeURIComponent(env.MOLIT_API_KEY!)}&LAWD_CD=11110&DEAL_YMD=${month}&pageNo=1&numOfRows=1`;
    }
    const response = await fetcher(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Health check status ${response.status}`);
    if (service === "molit") {
      const body = await response.text();
      if (!/<resultCode>(000|00|0)<\/resultCode>/.test(body))
        throw new Error("Invalid provider response");
    }
    return { status: "success", checkedAt, requestId };
  } catch {
    return { status: "failed", checkedAt, requestId };
  }
}
