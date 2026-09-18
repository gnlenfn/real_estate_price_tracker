"use client";
import { useEffect, useState } from "react";
import { AdminNav } from "@/app/components/admin-nav";
import { AdminDataLoading } from "@/app/components/admin-data-loading";
import { readAdminCache, writeAdminCache } from "@/lib/admin-client-cache";
import { supabase } from "@/lib/supabase";
type Service = {
  service: "supabase" | "molit" | "kakao" | "github";
  configured: boolean;
  last: { status: string; checked_at: string; request_id: string } | null;
};
const names = { supabase: "Supabase", molit: "국토교통부", kakao: "카카오 검색", github: "GitHub" };
export default function AdminIntegrationsPage() {
  const cacheKey = "/api/admin/integrations";
  const [services, setServices] = useState<Service[]>([]),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(""),
    [loading, setLoading] = useState(true);
  async function headers() {
    const {
      data: { session },
    } = await supabase!.auth.getSession();
    if (!session) throw new Error("운영자 로그인이 필요합니다.");
    return { Authorization: `Bearer ${session.access_token}` };
  }
  async function load() {
    setLoading(true);
    try {
      const response = await fetch(cacheKey, { headers: await headers() }),
        body = await response.json();
      if (response.status === 401 || response.status === 403) {
        window.location.assign("/admin/login");
        return;
      }
      if (!response.ok) throw new Error(body.error);
      writeAdminCache(cacheKey, body);
      setServices(body.services);
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "연동 상태를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const cached = readAdminCache<{ services: Service[] }>(cacheKey);
    if (cached) setServices(cached.services);
    void load();
  }, []);
  async function check(service: string) {
    setBusy(service);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/integrations/${service}/check`, {
          method: "POST",
          headers: await headers(),
        }),
        body = await response.json();
      if (!response.ok) throw new Error(body.error);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "연동 상태를 점검하지 못했습니다.");
    } finally {
      setBusy("");
    }
  }
  return (
    <main className="admin-page">
      <AdminNav active="integrations" />
      <div className="admin-heading">
        <div>
          <h1>연동 상태</h1>
          <p>설정 여부와 마지막 읽기 점검 결과를 확인합니다.</p>
        </div>
        {loading && services.length > 0 && <small className="muted">갱신 중…</small>}
      </div>
      {notice && <p className="admin-notice">{notice}</p>}
      {loading && !services.length ? (
        <AdminDataLoading label="연동 상태" />
      ) : (
        <>
          <section className="sync-overview">
            {services.map((item) => (
              <article
                className={`panel sync-health ${item.last?.status || ""}`}
                key={item.service}
              >
                <small>{item.configured ? "설정됨" : "미설정"}</small>
                <strong>{names[item.service]}</strong>
                <p>
                  {item.last
                    ? `${item.last.status} · ${new Date(item.last.checked_at).toLocaleString("ko-KR")}`
                    : "아직 점검하지 않음"}
                </p>
                <button
                  className="button"
                  disabled={busy === item.service}
                  onClick={() => void check(item.service)}
                >
                  {busy === item.service ? "점검 중…" : "지금 점검"}
                </button>
              </article>
            ))}
          </section>
          <p className="muted">GitHub 점검은 저장소 읽기만 확인하며 이슈를 만들지 않습니다.</p>
        </>
      )}
    </main>
  );
}
