"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ImagePlus, MessageSquareText, Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  appendAttachments,
  attachmentTypes,
  canReply,
  maxAttachmentCount,
  supportStatusLabel,
  type SupportStatus,
  validateAttachments,
} from "@/lib/support-inbox";
import { reportClientError } from "@/lib/client-error";

type Ticket = {
  id: string;
  category: string;
  title: string;
  body: string;
  status: SupportStatus;
  created_at: string;
  last_activity_at: string;
};
type Message = { id: string; author_role: "user" | "admin"; body: string; created_at: string };
type Attachment = {
  id: string;
  ticket_id: string;
  storage_path: string;
  file_name: string;
  created_at: string;
};
const successMessage = "문의가 접수되었습니다.";
const safeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "image";
export const attachmentPath = (userId: string, ticketId: string, fileName: string, id: string) =>
  `${userId}/${ticketId}/${id}-${safeName(fileName)}`;

export function SupportInbox({ userId }: { userId: string }) {
  const [tickets, setTickets] = useState<Ticket[]>([]),
    [selected, setSelected] = useState<Ticket | null>(null),
    [messages, setMessages] = useState<Message[]>([]),
    [attachments, setAttachments] = useState<Attachment[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [files, setFiles] = useState<File[]>([]);
  async function authHeader() {
    const {
      data: { session },
    } = await supabase!.auth.getSession();
    if (!session) throw new Error("로그인 후 문의해 주세요.");
    return { Authorization: `Bearer ${session.access_token}` };
  }
  async function load() {
    if (!supabase) return;
    const { data, error } = await supabase
      .schema("support")
      .from("tickets")
      .select("id,category,title,body,status,created_at,last_activity_at")
      .order("last_activity_at", { ascending: false });
    if (error) {
      void reportClientError("support.load", error.code);
      setMessage("문의를 불러오지 못했습니다.");
      return;
    }
    setTickets(data as Ticket[]);
  }
  async function open(ticket: Ticket) {
    if (!supabase) return;
    setSelected(ticket);
    const support = supabase.schema("support");
    const [m, a] = await Promise.all([
      support
        .from("messages")
        .select("id,author_role,body,created_at")
        .eq("ticket_id", ticket.id)
        .order("created_at"),
      support
        .from("attachments")
        .select("id,ticket_id,storage_path,file_name,created_at")
        .eq("ticket_id", ticket.id)
        .order("created_at"),
    ]);
    if (m.error || a.error) void reportClientError("support.load", m.error?.code || a.error?.code);
    setMessages((m.data || []) as Message[]);
    setAttachments((a.data || []) as Attachment[]);
  }
  useEffect(() => {
    void load();
  }, []);
  const selectedFiles = useMemo(
    () => files.map((file) => ({ type: file.type, size: file.size })),
    [files],
  );
  async function upload(ticketId: string) {
    if (!supabase || !files.length) return;
    for (const file of files) {
      const path = attachmentPath(userId, ticketId, file.name, crypto.randomUUID());
      const { error: uploadError } = await supabase.storage
        .from("support-attachments")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        void reportClientError("support.upload", uploadError.statusCode);
        throw new Error(`${file.name} 이미지를 올리지 못했습니다.`);
      }
      const { error: rowError } = await supabase.schema("support").from("attachments").insert({
        ticket_id: ticketId,
        user_id: userId,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        byte_size: file.size,
      });
      if (rowError) {
        void reportClientError("support.attachment", rowError.code);
        throw new Error(`${file.name} 정보를 저장하지 못했습니다.`);
      }
    }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      data = new FormData(form),
      validation = validateAttachments(selectedFiles);
    if (validation) {
      setMessage(validation);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const headers = await authHeader();
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          category: data.get("category"),
          title: String(data.get("title") || "").trim(),
          body: String(data.get("body") || "").trim(),
          screen: "문의",
        }),
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "문의를 접수하지 못했습니다.");
      try {
        await upload(result.ticketId);
      } catch (error) {
        setMessage(
          `${successMessage} ${error instanceof Error ? error.message : "이미지 첨부에 실패했습니다."}`,
        );
      } finally {
        form.reset();
        setFiles([]);
      }
      await load();
      setMessage((current) => current || successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "문의를 접수하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget,
      data = new FormData(form);
    setBusy(true);
    setMessage("");
    try {
      const headers = await authHeader(),
        response = await fetch(`/api/support/${selected.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ body: String(data.get("body") || "") }),
          signal: AbortSignal.timeout(20000),
        }),
        result = await response.json();
      if (!response.ok) throw new Error(result.error || "답글을 저장하지 못했습니다.");
      form.reset();
      await load();
      await open({ ...selected, status: "open" });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "답글을 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  async function imageUrl(path: string) {
    if (!supabase) return "";
    const { data, error } = await supabase.storage
      .from("support-attachments")
      .createSignedUrl(path, 60);
    return error ? "" : data.signedUrl;
  }
  return (
    <section className="support-inbox">
      <div className="support-create panel">
        <MessageSquareText size={25} />
        <h1>문의</h1>
        <p>오류나 개선 의견을 남겨 주세요. 답변은 이 화면에서 확인할 수 있습니다.</p>
        <form className="support-form" onSubmit={create}>
          <label>
            문의 유형
            <select name="category" defaultValue="bug">
              <option value="bug">오류 제보</option>
              <option value="feature">기능 제안</option>
              <option value="question">사용 문의</option>
            </select>
          </label>
          <label>
            제목
            <input
              name="title"
              minLength={3}
              maxLength={100}
              required
              placeholder="문의 내용을 짧게 적어 주세요"
            />
          </label>
          <label>
            내용
            <textarea
              name="body"
              minLength={10}
              maxLength={4000}
              required
              rows={6}
              placeholder="발생 과정이나 원하는 기능을 자세히 적어 주세요"
              onPaste={(event) => {
                const pasted = Array.from(event.clipboardData.files).filter((file) =>
                  attachmentTypes.includes(file.type as (typeof attachmentTypes)[number]),
                );
                if (pasted.length) {
                  event.preventDefault();
                  setFiles((current) => appendAttachments(current, pasted));
                }
              }}
            />
          </label>
          <label className="file-input">
            <ImagePlus size={17} />
            이미지 첨부{" "}
            <small>PNG, JPEG, WebP · 최대 3개 · 각 5MB · 내용 입력란에 붙여넣기 가능</small>
            <input
              type="file"
              accept={attachmentTypes.join(",")}
              multiple
              onChange={(event) =>
                setFiles((current) =>
                  appendAttachments(current, Array.from(event.target.files || [])),
                )
              }
            />
          </label>
          {files.length > 0 && <small>{files.map((file) => file.name).join(", ")}</small>}
          <button className="button primary" disabled={busy}>
            {busy ? "접수 중…" : "문의 접수"}
          </button>
        </form>
        {message && (
          <p className="form-message" role="status">
            {message}
          </p>
        )}
      </div>
      <div className="support-history panel">
        <h2>내 문의</h2>
        {!tickets.length ? (
          <p className="muted">아직 접수한 문의가 없습니다.</p>
        ) : (
          <div className="ticket-list">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                className={selected?.id === ticket.id ? "selected" : ""}
                onClick={() => void open(ticket)}
              >
                <span className={`ticket-status ${ticket.status}`}>
                  {supportStatusLabel(ticket.status)}
                </span>
                <strong>{ticket.title}</strong>
                <small>{new Date(ticket.last_activity_at).toLocaleDateString("ko-KR")}</small>
              </button>
            ))}
          </div>
        )}
        {selected && (
          <div className="ticket-detail">
            <h3>{selected.title}</h3>
            <p>{selected.body}</p>
            {attachments.map((attachment) => (
              <button
                className="attachment-link"
                key={attachment.id}
                onClick={async () => {
                  const url = await imageUrl(attachment.storage_path);
                  if (url) window.open(url, "_blank", "noopener,noreferrer");
                }}
              >
                <ImagePlus size={15} />
                {attachment.file_name}
              </button>
            ))}
            {messages.map((item) => (
              <article
                key={item.id}
                className={item.author_role === "admin" ? "admin-message" : "user-message"}
              >
                <small>
                  {item.author_role === "admin" ? "운영자" : "나"} ·{" "}
                  {new Date(item.created_at).toLocaleString("ko-KR")}
                </small>
                <p>{item.body}</p>
              </article>
            ))}
            {canReply(selected.status) ? (
              <form className="support-reply" onSubmit={reply}>
                <textarea
                  name="body"
                  minLength={1}
                  maxLength={4000}
                  required
                  rows={3}
                  placeholder="추가 내용을 남겨 주세요"
                />
                <button className="button" disabled={busy}>
                  <Send size={16} />
                  보내기
                </button>
              </form>
            ) : (
              <p className="muted">종료된 문의입니다.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
