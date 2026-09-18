"use client";
import { FormEvent, useEffect, useState } from "react";
import { ExternalLink, ImageIcon, Send } from "lucide-react";
import { AdminNav } from "@/app/components/admin-nav";
import { AdminDataLoading } from "@/app/components/admin-data-loading";
import { adminSearchDelay, readAdminCache, writeAdminCache } from "@/lib/admin-client-cache";
import { supabase } from "@/lib/supabase";
import { supportStatusLabel, type SupportStatus } from "@/lib/support-inbox";

type Ticket = {
  id: string;
  category: string;
  title: string;
  body: string;
  status: SupportStatus;
  created_at: string;
  last_activity_at: string;
  nickname: string;
  github_issue_number: number | null;
  github_issue_url: string | null;
};
type Detail = {
  ticket: Ticket & { screen: string; browser: string };
  messages: { id: string; author_role: "user" | "admin"; body: string; created_at: string }[];
  attachments: { id: string; file_name: string; url: string | null; created_at: string }[];
  notes: { id: string; body: string; created_at: string }[];
};

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]),
    [detail, setDetail] = useState<Detail | null>(null),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(""),
    [category, setCategory] = useState(""),
    [github, setGithub] = useState(""),
    [search, setSearch] = useState(""),
    [initialized, setInitialized] = useState(false);
  async function authHeader() {
    const {
      data: { session },
    } = await supabase!.auth.getSession();
    if (!session) throw new Error("운영자 로그인이 필요합니다.");
    return { Authorization: `Bearer ${session.access_token}` };
  }
  function listPath() {
    const params = new URLSearchParams({
      ...(status && { status }),
      ...(category && { category }),
      ...(github && { github }),
      ...(search && { search }),
    });
    return `/api/admin/support?${params}`;
  }
  async function load(path = listPath()) {
    if (!supabase) return;
    setLoading(true);
    try {
      const response = await fetch(path, { headers: await authHeader() }),
        result = await response.json();
      if (response.status === 401 || response.status === 403) {
        window.location.assign("/admin/login");
        return;
      }
      if (!response.ok) throw new Error(result.error);
      writeAdminCache(path, result);
      setTickets(result.tickets);
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "문의함을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }
  async function open(ticketId: string) {
    const path = `/api/admin/support/${ticketId}`,
      cached = readAdminCache<Detail>(path);
    if (cached) setDetail(cached);
    try {
      const response = await fetch(path, { headers: await authHeader() }),
        result = await response.json();
      if (!response.ok) throw new Error(result.error);
      writeAdminCache(path, result);
      setDetail(result);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "문의 내용을 불러오지 못했습니다.");
    }
  }
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setStatus(params.get("status") || "");
    setSearch(params.get("search") || "");
    const ticket = params.get("ticket");
    if (ticket) void open(ticket);
    setInitialized(true);
  }, []);
  useEffect(() => {
    if (!initialized) return;
    const path = listPath(),
      cached = readAdminCache<{ tickets: Ticket[] }>(path);
    if (cached) setTickets(cached.tickets);
    else setTickets([]);
    setLoading(true);
    const timer = setTimeout(() => void load(path), adminSearchDelay(search));
    return () => clearTimeout(timer);
  }, [status, category, github, search, initialized]);
  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    const form = event.currentTarget,
      data = new FormData(form);
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/support/${detail.ticket.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...(await authHeader()) },
          body: JSON.stringify({ body: data.get("body"), status: data.get("status") }),
        }),
        result = await response.json();
      if (!response.ok) throw new Error(result.error);
      form.reset();
      await load();
      await open(detail.ticket.id);
      setNotice("답변과 처리 상태를 저장했습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "답변을 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    const form = event.currentTarget,
      data = new FormData(form);
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/support/${detail.ticket.id}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeader()) },
          body: JSON.stringify({ body: data.get("body") }),
        }),
        result = await response.json();
      if (!response.ok) throw new Error(result.error);
      form.reset();
      await open(detail.ticket.id);
      setNotice("내부 메모를 저장했습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "내부 메모를 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  async function sendGithub() {
    if (!detail) return;
    setBusy(true);
    try {
      const title = (document.getElementById("github-title") as HTMLInputElement).value,
        body = (document.getElementById("github-body") as HTMLTextAreaElement).value,
        response = await fetch(`/api/admin/support/${detail.ticket.id}/github`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeader()) },
          body: JSON.stringify({ title, body }),
        }),
        result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await load();
      await open(detail.ticket.id);
      setNotice(`GitHub Issue #${result.number}로 등록했습니다.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "GitHub 이슈로 등록하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-page">
      <AdminNav active="support" />
      <div className="admin-heading">
        <div>
          <h1>문의 관리</h1>
          <p>사용자 문의에 답변하고 운영 메모를 남깁니다.</p>
        </div>
        <span>{loading && tickets.length ? "갱신 중…" : `${tickets.length}건`}</span>
      </div>
      <section className="admin-filters">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="제목 또는 닉네임 검색"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">모든 상태</option>
          <option value="open">접수</option>
          <option value="answered">답변 완료</option>
          <option value="closed">종료</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">모든 유형</option>
          <option value="bug">오류 제보</option>
          <option value="feature">기능 제안</option>
          <option value="question">사용 문의</option>
        </select>
        <select value={github} onChange={(e) => setGithub(e.target.value)}>
          <option value="">GitHub 전체</option>
          <option value="pending">미등록</option>
          <option value="sent">등록됨</option>
        </select>
      </section>
      {notice && <p className="admin-notice">{notice}</p>}
      {loading && !tickets.length ? (
        <AdminDataLoading label="문의 목록" />
      ) : (
        <div className="admin-support">
          <section className="panel ticket-list">
            {tickets.length ? (
              tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => void open(ticket.id)}
                  className={detail?.ticket.id === ticket.id ? "selected" : ""}
                >
                  <span className={`ticket-status ${ticket.status}`}>
                    {supportStatusLabel(ticket.status)}
                  </span>
                  <strong>{ticket.title}</strong>
                  <small>
                    {ticket.nickname} · {new Date(ticket.last_activity_at).toLocaleString("ko-KR")}
                  </small>
                </button>
              ))
            ) : (
              <p className="muted">조건에 맞는 문의가 없습니다.</p>
            )}
          </section>
          <section className="panel ticket-detail">
            {detail ? (
              <>
                <div className="ticket-title">
                  <div>
                    <span className={`ticket-status ${detail.ticket.status}`}>
                      {supportStatusLabel(detail.ticket.status)}
                    </span>
                    <h2>{detail.ticket.title}</h2>
                    <small>
                      {detail.ticket.nickname} ·{" "}
                      {new Date(detail.ticket.created_at).toLocaleString("ko-KR")}
                    </small>
                  </div>
                  {detail.ticket.github_issue_url && (
                    <a href={detail.ticket.github_issue_url} target="_blank" rel="noreferrer">
                      GitHub 열기 <ExternalLink size={15} />
                    </a>
                  )}
                </div>
                <article className="conversation user-message">
                  <small>최초 문의</small>
                  <p>{detail.ticket.body}</p>
                </article>
                {detail.attachments.map((file) =>
                  file.url ? (
                    <a
                      className="admin-attachment"
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      key={file.id}
                    >
                      <img src={file.url} alt={file.file_name} />
                      <span>
                        <ImageIcon size={15} />
                        {file.file_name}
                      </span>
                    </a>
                  ) : null,
                )}
                {detail.messages.map((item) => (
                  <article className={`conversation ${item.author_role}-message`} key={item.id}>
                    <small>
                      {item.author_role === "admin" ? "운영자 답변" : "사용자 추가 내용"} ·{" "}
                      {new Date(item.created_at).toLocaleString("ko-KR")}
                    </small>
                    <p>{item.body}</p>
                  </article>
                ))}
                <section className="admin-notes">
                  <h3>내부 메모</h3>
                  {detail.notes.map((note) => (
                    <article className="conversation internal-note" key={note.id}>
                      <small>
                        운영자 전용 · {new Date(note.created_at).toLocaleString("ko-KR")}
                      </small>
                      <p>{note.body}</p>
                    </article>
                  ))}
                  <form className="support-form" onSubmit={saveNote}>
                    <label>
                      메모
                      <textarea name="body" maxLength={4000} rows={3} required />
                    </label>
                    <button className="button" disabled={busy}>
                      메모 저장
                    </button>
                  </form>
                </section>
                <form className="support-form admin-reply" onSubmit={reply}>
                  <label>
                    처리 상태
                    <select name="status" defaultValue={detail.ticket.status}>
                      <option value="open">접수</option>
                      <option value="answered">답변 완료</option>
                      <option value="closed">종료</option>
                    </select>
                  </label>
                  <label>
                    사용자 답변
                    <textarea name="body" maxLength={4000} rows={5} />
                  </label>
                  <button className="button primary" disabled={busy}>
                    <Send size={16} />
                    답변 및 상태 저장
                  </button>
                </form>
                <section className="github-transfer">
                  <h3>개발 이슈로 전환</h3>
                  {detail.ticket.github_issue_number ? (
                    <p>GitHub Issue #{detail.ticket.github_issue_number}로 등록되었습니다.</p>
                  ) : (
                    <>
                      <label>
                        이슈 제목
                        <input id="github-title" defaultValue={detail.ticket.title} />
                      </label>
                      <label>
                        이슈 본문
                        <textarea id="github-body" defaultValue={detail.ticket.body} rows={5} />
                      </label>
                      <button className="button" disabled={busy} onClick={() => void sendGithub()}>
                        GitHub 이슈로 등록
                      </button>
                    </>
                  )}
                </section>
              </>
            ) : (
              <p className="muted">왼쪽에서 문의를 선택하세요.</p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
