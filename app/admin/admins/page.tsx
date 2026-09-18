"use client";
import { useCallback, useEffect, useState } from "react";
import { AdminNav } from "@/app/components/admin-nav";
import { AdminDataLoading } from "@/app/components/admin-data-loading";
import { adminSearchDelay, readAdminCache, writeAdminCache } from "@/lib/admin-client-cache";
import { supabase } from "@/lib/supabase";
type Person = {
  id: string;
  nickname: string;
  provider: string;
  joinedAt: string;
  role: "super_admin" | "admin" | null;
  addedAt: string | null;
  createdByNickname: string | null;
};
type Audit = { id: string; action: string; target_id: string; outcome: string; created_at: string };
type Payload = { admins: Person[]; candidates: Person[]; audit: Audit[] };
export default function AdminRolesPage() {
  const [admins, setAdmins] = useState<Person[]>([]),
    [candidates, setCandidates] = useState<Person[]>([]),
    [audit, setAudit] = useState<Audit[]>([]),
    [search, setSearch] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const request = useCallback(async (path: string, init?: RequestInit) => {
    const {
      data: { session },
    } = await supabase!.auth.getSession();
    if (!session) {
      window.location.assign("/admin/login");
      throw new Error("로그인이 필요합니다.");
    }
    const response = await fetch(path, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          ...init?.headers,
        },
      }),
      body = await response.json();
    if (!response.ok) throw new Error(body.error || "요청을 처리하지 못했습니다.");
    return body;
  }, []);
  const load = useCallback(
    async (path: string) => {
      setLoading(true);
      try {
        const body = (await request(path)) as Payload;
        writeAdminCache(path, body);
        setAdmins(body.admins);
        setCandidates(body.candidates);
        setAudit(body.audit);
        setNotice("");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "관리자 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    },
    [request],
  );
  useEffect(() => {
    const path = `/api/admin/admins?search=${encodeURIComponent(search)}`,
      cached = readAdminCache<Payload>(path);
    if (cached) {
      setAdmins(cached.admins);
      setCandidates(cached.candidates);
      setAudit(cached.audit);
    } else {
      setAdmins([]);
      setCandidates([]);
      setAudit([]);
    }
    setLoading(true);
    const timer = setTimeout(() => void load(path), adminSearchDelay(search));
    return () => clearTimeout(timer);
  }, [load, search]);
  async function mutate(path: string, method: string, userId: string) {
    setBusy(true);
    try {
      await request(path, { method, body: JSON.stringify({ userId }) });
      await load(`/api/admin/admins?search=${encodeURIComponent(search)}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "변경하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  const superAdmin = admins.find((item) => item.role === "super_admin"),
    regular = admins.filter((item) => item.role === "admin"),
    hasData = admins.length > 0 || candidates.length > 0 || audit.length > 0;
  return (
    <main className="admin-page">
      <AdminNav active="admins" />
      <div className="admin-heading">
        <div>
          <h1>관리자 관리</h1>
          <p>최고 관리자가 소셜 가입자의 운영 권한을 관리합니다.</p>
        </div>
        {loading && hasData && <small className="muted">갱신 중…</small>}
      </div>
      {notice && <p className="admin-notice">{notice}</p>}
      {loading && !hasData ? (
        <AdminDataLoading label="관리자 정보" />
      ) : (
        <>
          <section className="admin-role-grid">
            <article className="panel admin-role-card">
              <h2>최고 관리자</h2>
              {superAdmin ? (
                <>
                  <strong>{superAdmin.nickname}</strong>
                  <p>
                    {superAdmin.provider} ·{" "}
                    {new Date(superAdmin.joinedAt).toLocaleDateString("ko-KR")}
                  </p>
                </>
              ) : (
                <p>권한이 없거나 최고 관리자 정보가 없습니다.</p>
              )}
            </article>
            <article className="panel admin-role-card">
              <h2>사용자 검색</h2>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="닉네임 검색"
              />
              {candidates.map((person) => (
                <div className="admin-role-row" key={person.id}>
                  <span>
                    <strong>{person.nickname}</strong>
                    <small>{person.provider}</small>
                  </span>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => mutate("/api/admin/admins", "POST", person.id)}
                  >
                    관리자 추가
                  </button>
                </div>
              ))}
            </article>
          </section>
          <section className="panel sync-history">
            <h2>일반 관리자</h2>
            {regular.map((person) => (
              <div className="admin-role-row" key={person.id}>
                <span>
                  <strong>{person.nickname}</strong>
                  <small>
                    {person.provider} ·{" "}
                    {person.addedAt ? new Date(person.addedAt).toLocaleDateString("ko-KR") : ""}
                  </small>
                </span>
                <div>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => mutate(`/api/admin/admins/${person.id}`, "DELETE", person.id)}
                  >
                    해제
                  </button>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.prompt(
                          `최고 관리자 이전을 확인하려면 ${person.nickname}을 입력하세요.`,
                        ) === person.nickname
                      )
                        void mutate("/api/admin/admins/transfer", "POST", person.id);
                    }}
                  >
                    최고 관리자 이전
                  </button>
                </div>
              </div>
            ))}
          </section>
          <section className="panel sync-history">
            <h2>권한 변경 기록</h2>
            {audit.map((event) => (
              <div className="admin-role-row" key={event.id}>
                <span>
                  <strong>{event.action}</strong>
                  <small>{new Date(event.created_at).toLocaleString("ko-KR")}</small>
                </span>
                <em>{event.outcome}</em>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
