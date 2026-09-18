import { createClient } from "@supabase/supabase-js";
import { isLocalSupabase } from "@/app/api/auth/local/route";
export const dynamic = "force-dynamic";
export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    secret = process.env.SUPABASE_SECRET_KEY,
    email = process.env.LOCAL_ADMIN_EMAIL,
    password = process.env.LOCAL_ADMIN_PASSWORD;
  if (!isLocalSupabase(url))
    return Response.json({ error: "로컬 개발 환경에서만 사용할 수 있습니다." }, { status: 404 });
  if (!publishable || !secret || !email || !password)
    return Response.json({ error: "로컬 관리자 설정을 확인해 주세요." }, { status: 503 });
  const auth = createClient(url, publishable, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    service = createClient(url, secret, {
      db: { schema: "app" },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  let signedIn = await auth.auth.signInWithPassword({ email, password });
  if (signedIn.error) {
    const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error && !created.error.message.toLowerCase().includes("already"))
      return Response.json({ error: "로컬 관리자를 준비하지 못했습니다." }, { status: 500 });
    signedIn = await auth.auth.signInWithPassword({ email, password });
  }
  const session = signedIn.data.session;
  if (!session)
    return Response.json({ error: "로컬 관리자 로그인에 실패했습니다." }, { status: 500 });
  const adminDb = service.schema("admin"),
    { data: superAdmin, error: lookupError } = await adminDb
      .from("admins")
      .select("user_id")
      .eq("role", "super_admin")
      .maybeSingle();
  if (lookupError)
    return Response.json({ error: "로컬 관리자 권한을 확인하지 못했습니다." }, { status: 500 });
  if (superAdmin && superAdmin.user_id !== session.user.id)
    return Response.json({ error: "이미 다른 최고 관리자가 등록되어 있습니다." }, { status: 409 });
  const { error } = await adminDb
    .from("admins")
    .upsert({ user_id: session.user.id, role: "super_admin" }, { onConflict: "user_id" });
  if (error)
    return Response.json({ error: "로컬 관리자 권한을 준비하지 못했습니다." }, { status: 500 });
  return Response.json({ accessToken: session.access_token, refreshToken: session.refresh_token });
}
