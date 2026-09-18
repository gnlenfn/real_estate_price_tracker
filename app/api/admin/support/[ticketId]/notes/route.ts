import { adminAccessResponse, requireAdmin } from "@/lib/admin-server";
import { serverError } from "@/lib/api-error";
import { validateAdminNote } from "@/lib/admin-notes";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  try {
    const { ticketId } = await params,
      { user, admin } = await requireAdmin(request),
      body = String((await request.json()).body || "").trim();
    const validation = validateAdminNote(body);
    if (validation) return Response.json({ error: validation }, { status: 400 });
    const { data, error } = await admin.schema("admin").rpc("add_support_internal_note", {
      p_ticket_id: ticketId,
      p_author_id: user.id,
      p_body: body,
      p_request_id: crypto.randomUUID(),
    });
    if (error) {
      if (error.message.includes("Ticket not found"))
        return Response.json({ error: "문의를 찾을 수 없습니다." }, { status: 404 });
      throw error;
    }
    return Response.json({ note: data?.[0] }, { status: 201 });
  } catch (error) {
    return (
      adminAccessResponse(error) ??
      serverError("admin.support.note", error, "내부 메모를 저장하지 못했습니다.")
    );
  }
}
