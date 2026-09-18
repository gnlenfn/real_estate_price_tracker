import { adminAccessResponse, requireAdmin } from "@/lib/admin-server";
import { cronHealth } from "@/lib/admin-overview";
import { serverError } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    const { admin } = await requireAdmin(request),
      support = admin.schema("support"),
      adminDb = admin.schema("admin"),
      since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [unanswered, newTickets, runs] = await Promise.all([
      support.from("tickets").select("*", { count: "exact", head: true }).eq("status", "open"),
      support.from("tickets").select("*", { count: "exact", head: true }).gte("created_at", since),
      adminDb
        .from("trade_sync_runs")
        .select("id,trigger,status,started_at,finished_at,failure_count")
        .order("started_at", { ascending: false })
        .limit(30),
    ]);
    if (unanswered.error || newTickets.error || runs.error)
      throw unanswered.error || newTickets.error || runs.error;
    const allRuns = runs.data || [],
      cron = cronHealth(allRuns, new Date(), process.env.CRON_ENABLED_AT || null);
    return Response.json({
      unansweredCount: unanswered.count || 0,
      newTicketCount7d: newTickets.count || 0,
      cron,
      recentFailures: allRuns
        .filter((run) => run.status === "failed" || run.status === "partial")
        .slice(0, 5)
        .map((run) => ({ id: run.id, startedAt: run.started_at, failureCount: run.failure_count })),
    });
  } catch (error) {
    return (
      adminAccessResponse(error) ??
      serverError("admin.overview", error, "운영 현황을 불러오지 못했습니다.")
    );
  }
}
