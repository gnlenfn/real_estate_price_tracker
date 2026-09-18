import { validateMessage } from "@/lib/support";
import { serverError } from "@/lib/api-error";
import { supportServer } from "@/lib/support-server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  try {
    const { ticketId } = await params,
      { user, admin } = await supportServer(request),
      support = admin.schema("support");
    const input = await request.json(),
      body = String(input.body || "").trim(),
      validation = validateMessage(body);
    if (validation) return Response.json({ error: validation }, { status: 400 });
    const { data: ticket, error: ticketError } = await support
      .from("tickets")
      .select("id,status")
      .eq("id", ticketId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (ticketError || !ticket)
      return Response.json({ error: "문의를 찾을 수 없습니다." }, { status: 404 });
    if (ticket.status === "closed")
      return Response.json({ error: "종료된 문의에는 답글을 남길 수 없습니다." }, { status: 409 });
    const now = new Date().toISOString();
    const { data, error } = await support
      .from("messages")
      .insert({ ticket_id: ticketId, author_id: user.id, author_role: "user", body })
      .select("id,created_at")
      .single();
    if (error)
      return serverError("support.reply", error, "답글을 저장하지 못했습니다.", 500, { ticketId });
    await support
      .from("tickets")
      .update({ status: "open", last_activity_at: now, updated_at: now })
      .eq("id", ticketId);
    return Response.json(data);
  } catch (error) {
    return serverError("support.reply-auth", error, "로그인을 확인한 뒤 다시 시도해 주세요.", 401);
  }
}
