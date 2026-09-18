import { adminAccessResponse, requireAdmin } from "@/lib/admin-server";
import { publicAdminUser } from "@/lib/admin-users";
import { serverError } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    const { admin } = await requireAdmin(request),
      params = new URL(request.url).searchParams,
      before = params.get("before");
    let cursor: { joinedAt: string; id: string } | null = null;
    try {
      cursor = before ? JSON.parse(Buffer.from(before, "base64url").toString()) : null;
    } catch {
      return Response.json({ error: "페이지 정보를 확인해 주세요." }, { status: 400 });
    }
    const { data, error } = await admin.schema("admin").rpc("list_users", {
      p_search: (params.get("search") || "").trim(),
      p_before_joined_at: cursor?.joinedAt || null,
      p_before_id: cursor?.id || null,
      p_limit: 50,
    });
    if (error) throw error;
    const rows = data || [],
      users = rows.map(publicAdminUser),
      last = users.at(-1);
    return Response.json({
      users,
      nextCursor:
        rows.length === 50 && last
          ? Buffer.from(JSON.stringify({ joinedAt: last.joinedAt, id: last.id })).toString(
              "base64url",
            )
          : null,
    });
  } catch (error) {
    return (
      adminAccessResponse(error) ??
      serverError("admin.users", error, "사용자 목록을 불러오지 못했습니다.")
    );
  }
}
