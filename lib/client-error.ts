export async function reportClientError(operation: string, code: string | undefined) {
  try {
    const { supabase } = await import("./supabase");
    const {
      data: { session },
    } = await supabase!.auth.getSession();
    if (!session) return;
    await fetch("/api/client-errors", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ operation, code: String(code || "unknown").slice(0, 80) }),
      keepalive: true,
    });
  } catch {}
}
