import { adminAccessResponse, requireAdmin } from "@/lib/admin-server";
import {
  integrationConfigured,
  runExternalIntegrationCheck,
  type IntegrationService,
} from "@/lib/integration-checks";
import { serverError } from "@/lib/api-error";

const allowed = new Set<IntegrationService>(["supabase", "molit", "kakao", "github"]);
export async function POST(request: Request, { params }: { params: Promise<{ service: string }> }) {
  try {
    const { service: raw } = await params;
    if (!allowed.has(raw as IntegrationService))
      return Response.json({ error: "점검 대상을 확인해 주세요." }, { status: 400 });
    const service = raw as IntegrationService,
      { admin } = await requireAdmin(request),
      adminDb = admin.schema("admin");
    const { data: last, error: lastError } = await adminDb
      .from("integration_checks")
      .select("checked_at")
      .eq("service", service)
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastError) throw lastError;
    if (last && Date.now() - new Date(last.checked_at).getTime() < 60000)
      return Response.json({ error: "1분 후 다시 점검해 주세요." }, { status: 429 });
    let result;
    if (service === "supabase") {
      const checkedAt = new Date().toISOString(),
        requestId = crypto.randomUUID();
      if (!integrationConfigured(service))
        result = { status: "unconfigured" as const, checkedAt, requestId };
      else {
        const { error } = await adminDb.from("trade_sync_runs").select("id").limit(1);
        result = {
          status: error ? ("failed" as const) : ("success" as const),
          checkedAt,
          requestId,
        };
      }
    } else result = await runExternalIntegrationCheck(service);
    const { error } = await adminDb.from("integration_checks").insert({
      service,
      status: result.status,
      request_id: result.requestId,
      checked_at: result.checkedAt,
    });
    if (error) throw error;
    return Response.json(result);
  } catch (error) {
    return (
      adminAccessResponse(error) ??
      serverError("admin.integration.check", error, "연동 상태를 점검하지 못했습니다.")
    );
  }
}
