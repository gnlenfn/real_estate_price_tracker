export type AdminRole = "super_admin" | "admin";
export type AdminRoleUser = {
  id: string;
  nickname: string;
  provider: string;
  joinedAt: string;
  role: AdminRole | null;
  addedAt: string | null;
  createdByNickname: string | null;
};
export function validUserId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}
export function socialProvider(user: { app_metadata?: Record<string, unknown> }): string {
  const metadata = user.app_metadata || {},
    providers = Array.isArray(metadata.providers) ? metadata.providers.map(String) : [],
    values = [String(metadata.provider || ""), ...providers];
  return values.includes("google") ? "google" : values.includes("kakao") ? "kakao" : "other";
}
export function roleError(message: string) {
  if (message.includes("ALREADY_ADMIN"))
    return { status: 409, error: "이 사용자는 이미 관리자입니다." };
  if (message.includes("NOT_REMOVABLE") || message.includes("INVALID_TARGET"))
    return { status: 409, error: "변경할 수 없는 관리자입니다." };
  if (message.includes("FORBIDDEN")) return { status: 403, error: "권한이 없습니다." };
  return null;
}
