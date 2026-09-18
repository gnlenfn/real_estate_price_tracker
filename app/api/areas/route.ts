import { createClient } from "@supabase/supabase-js";
import { apartmentIdentity, fetchDistrictTrades } from "@/lib/molit";
import { serverError } from "@/lib/api-error";
export const maxDuration = 60;
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    key = process.env.MOLIT_API_KEY;
  if (!url || !anon || !key)
    return Response.json(
      { error: "면적 조회 서비스가 아직 준비되지 않았습니다." },
      { status: 503 },
    );
  const token = request.headers.get("authorization");
  if (!token?.startsWith("Bearer "))
    return Response.json({ error: "면적 목록을 불러오려면 로그인해 주세요." }, { status: 401 });
  const db = createClient(url, anon, {
    db: { schema: "app" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await db.auth.getUser(token.slice(7));
  if (error || !user) return Response.json({ error: "로그인을 다시 해 주세요." }, { status: 401 });
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "조회 조건을 확인해 주세요." }, { status: 400 });
  }
  const { district, dong, name, month, aptSeq, jibunAddress } = body || {};
  if (
    typeof district !== "string" ||
    !/^\d{5}$/.test(district) ||
    typeof dong !== "string" ||
    !dong.trim() ||
    dong.length > 100 ||
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 100 ||
    typeof month !== "string" ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
    month < "2006-01" ||
    month > new Date().toISOString().slice(0, 7)
  )
    return Response.json({ error: "주소와 단지명을 확인해 주세요." }, { status: 400 });
  if (
    (aptSeq != null && typeof aptSeq !== "string") ||
    (jibunAddress != null && typeof jibunAddress !== "string") ||
    String(aptSeq ?? "").length > 100 ||
    String(jibunAddress ?? "").length > 200
  )
    return Response.json({ error: "단지 식별 정보를 확인해 주세요." }, { status: 400 });
  try {
    return Response.json(
      apartmentIdentity(await fetchDistrictTrades(district, month, key, true), {
        name,
        dong,
        aptSeq,
        jibunAddress,
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return serverError(
      "areas.lookup",
      error,
      "실거래 면적 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      502,
    );
  }
}
