import { githubIssuePayload, validateSupportInput } from "@/lib/support";
import { serverError } from "@/lib/api-error";
import { adminAccessResponse, requireAdmin } from "@/lib/admin-server";
import { appendAdminEvent } from "@/lib/admin-audit";

class GithubTransferError extends Error {
  constructor(
    public outcome: "failed" | "unknown",
    message: string,
  ) {
    super(message);
  }
}
const headers = (token: string) => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "Content-Type": "application/json",
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  try {
    const { ticketId } = await params,
      { user, admin } = await requireAdmin(request),
      support = admin.schema("support"),
      requestId = crypto.randomUUID();
    const token = process.env.GITHUB_ISSUES_TOKEN,
      repository = process.env.GITHUB_ISSUES_REPOSITORY || "gnlenfn/real_estate_price_tracker";
    if (!token || !/^[-\w.]+\/[-\w.]+$/.test(repository))
      return Response.json({ error: "GitHub 전송 기능을 사용할 수 없습니다." }, { status: 503 });
    const { data: ticket, error } = await support
      .from("tickets")
      .select("id,user_id,category,title,body,screen,browser,github_issue_number,github_status")
      .eq("id", ticketId)
      .maybeSingle();
    if (error || !ticket)
      return Response.json({ error: "문의를 찾을 수 없습니다." }, { status: 404 });
    let input: Record<string, unknown> = {};
    try {
      input = await request.json();
    } catch {}
    if (typeof input.issueNumber === "number") {
      const response = await fetch(
        `https://api.github.com/repos/${repository}/issues/${input.issueNumber}`,
        { method: "GET", headers: headers(token), signal: AbortSignal.timeout(15000) },
      );
      if (!response.ok)
        return Response.json(
          { error: "지정한 GitHub 이슈를 확인할 수 없습니다." },
          { status: 400 },
        );
      const issue = await response.json();
      const expected = `https://github.com/${repository}/issues/${input.issueNumber}`;
      if (issue.html_url !== expected)
        return Response.json(
          { error: "설정된 저장소의 이슈만 연결할 수 있습니다." },
          { status: 400 },
        );
      const { error: updateError } = await support
        .from("tickets")
        .update({
          github_status: "sent",
          github_issue_number: input.issueNumber,
          github_issue_url: expected,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticketId);
      if (updateError) throw updateError;
      await appendAdminEvent(admin, {
        actorId: user.id,
        action: "github.transfer",
        targetId: ticketId,
        requestId,
        outcome: "success",
      });
      return Response.json({ number: input.issueNumber, url: expected });
    }
    if (ticket.github_issue_number)
      return Response.json({ error: "이미 GitHub 이슈로 등록된 문의입니다." }, { status: 409 });
    if (ticket.github_status === "unknown" || ticket.github_status === "sending")
      return Response.json(
        { error: "이전 전송 결과를 확인한 뒤 기존 이슈 번호를 연결해 주세요." },
        { status: 409 },
      );
    const title = String(input.title || ticket.title).trim(),
      body = String(input.body || ticket.body).trim(),
      validation = validateSupportInput({ category: ticket.category, title, body });
    if (validation) return Response.json({ error: validation }, { status: 400 });
    const { data: claim, error: claimError } = await support
      .from("tickets")
      .update({ github_status: "sending" })
      .eq("id", ticketId)
      .is("github_issue_number", null)
      .in("github_status", ["pending", "failed"])
      .select("id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claim)
      return Response.json({ error: "이미 GitHub 전송이 진행 중입니다." }, { status: 409 });
    const { data: profile } = await admin
      .from("profiles")
      .select("nickname")
      .eq("user_id", ticket.user_id)
      .maybeSingle();
    try {
      let response: Response;
      try {
        response = await fetch(`https://api.github.com/repos/${repository}/issues`, {
          method: "POST",
          headers: headers(token),
          body: JSON.stringify(
            githubIssuePayload({
              category: ticket.category,
              title,
              body,
              screen: ticket.screen,
              browser: ticket.browser,
              nickname: profile?.nickname || "집 사용자",
            }),
          ),
          signal: AbortSignal.timeout(15000),
        });
      } catch {
        throw new GithubTransferError("unknown", "GitHub response unavailable");
      }
      if (!response.ok)
        throw new GithubTransferError(
          response.status >= 500 ? "unknown" : "failed",
          `GitHub status ${response.status}`,
        );
      const issue = await response.json();
      if (typeof issue.number !== "number" || typeof issue.html_url !== "string")
        throw new GithubTransferError("unknown", "Invalid GitHub response");
      const { error: updateError } = await support
        .from("tickets")
        .update({
          github_status: "sent",
          github_issue_number: issue.number,
          github_issue_url: issue.html_url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticketId);
      if (updateError) throw new GithubTransferError("unknown", "Issue link save failed");
      await appendAdminEvent(admin, {
        actorId: user.id,
        action: "github.transfer",
        targetId: ticketId,
        requestId,
        outcome: "success",
      });
      return Response.json({ number: issue.number, url: issue.html_url });
    } catch (error) {
      const outcome = error instanceof GithubTransferError ? error.outcome : "unknown";
      await support.from("tickets").update({ github_status: outcome }).eq("id", ticketId);
      await appendAdminEvent(admin, {
        actorId: user.id,
        action: "github.transfer",
        targetId: ticketId,
        requestId,
        outcome,
      });
      throw error;
    }
  } catch (error) {
    return (
      adminAccessResponse(error) ??
      serverError("admin.support.github", error, "GitHub 이슈로 등록하지 못했습니다.")
    );
  }
}
