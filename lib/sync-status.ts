import type { ScheduledFailure } from "./weekly-sync";

export type SyncRunStatus = "running" | "success" | "partial" | "failed";
export type SyncHealth = SyncRunStatus | "delayed";
export type SyncRunLike = { status: SyncRunStatus; started_at: string; finished_at: string | null };

export function deriveSyncHealth(
  run: SyncRunLike | null,
  now = new Date(),
  maxAgeMs = 8 * 24 * 60 * 60 * 1000,
): SyncHealth {
  if (!run) return "delayed";
  const started = new Date(run.started_at).getTime();
  if (run.status === "running")
    return now.getTime() - started > 15 * 60 * 1000 ? "delayed" : "running";
  const completed = new Date(run.finished_at || run.started_at).getTime();
  return now.getTime() - completed > maxAgeMs ? "delayed" : run.status;
}

export function safeSyncFailures(failures: ScheduledFailure[]) {
  return failures.map(({ propertyId, name, month }) => ({
    propertyId,
    name: name.slice(0, 100),
    month,
  }));
}

export const syncHealthLabel = (status: SyncHealth) =>
  ({
    running: "실행 중",
    success: "정상 완료",
    partial: "일부 실패",
    failed: "실패",
    delayed: "실행 지연",
  })[status];
