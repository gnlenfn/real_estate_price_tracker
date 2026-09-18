import { serverError } from "@/lib/api-error";
import { runWeeklyTradeSync, SyncAlreadyRunningError } from "@/lib/weekly-sync-server";

export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`)
    return Response.json({ error: "요청을 처리할 수 없습니다." }, { status: 401 });
  try {
    return Response.json({ ok: true, run: await runWeeklyTradeSync("cron") });
  } catch (error) {
    if (error instanceof SyncAlreadyRunningError)
      return Response.json({ error: "자동수집이 이미 실행 중입니다." }, { status: 409 });
    return serverError("cron.trade-sync", error, "자동수집을 완료하지 못했습니다.", 502);
  }
}
