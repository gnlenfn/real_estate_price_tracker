import { adminAccessResponse, requireAdmin } from "@/lib/admin-server";
import { integrationConfigured, type IntegrationService } from "@/lib/integration-checks";
import { serverError } from "@/lib/api-error";

const services: IntegrationService[] = ["supabase", "molit", "kakao", "github"];
export async function GET(request: Request) {
  try {
    const { admin } = await requireAdmin(request),
      { data, error } = await admin
        .schema("admin")
        .from("integration_checks")
        .select("service,status,request_id,checked_at")
        .order("checked_at", { ascending: false })
        .limit(100);
    if (error) throw error;
    const latest = new Map<string, (typeof data)[number]>();
    for (const row of data || []) if (!latest.has(row.service)) latest.set(row.service, row);
    return Response.json({
      services: services.map((service) => ({
        service,
        configured: integrationConfigured(service),
        last: latest.get(service) || null,
      })),
    });
  } catch (error) {
    return (
      adminAccessResponse(error) ??
      serverError("admin.integrations", error, "연동 상태를 불러오지 못했습니다.")
    );
  }
}
