import { adminAccessResponse, requireAdmin } from "@/lib/admin-server";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return Response.json({ admin: true });
  } catch (error) {
    return adminAccessResponse(error) ?? Response.json({ admin: false }, { status: 500 });
  }
}
