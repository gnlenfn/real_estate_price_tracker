"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { areaGroup } from "@/lib/area";
import { areaSearchKey } from "@/lib/area-search";
export function PropertyArea({
  district,
  dong,
  name,
  jibunAddress,
  existing,
  existingAptSeq,
}: {
  district: string;
  dong: string;
  name: string;
  jibunAddress: string;
  existing?: number;
  existingAptSeq?: string | null;
}) {
  const current = existing === undefined ? undefined : areaGroup(existing);
  const [areas, setAreas] = useState<number[]>(current ? [current] : []),
    [value, setValue] = useState(current ? String(current) : "");
  const [aptSeq, setAptSeq] = useState(existingAptSeq ?? "");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [scanned, setScanned] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const identity = areaSearchKey({ district, dong, name, jibunAddress });
  useEffect(() => {
    controller.current?.abort();
    if (!identity) return;
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(() => void load(abort), 300);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
    // `identity` captures every field used by the request and intentionally restarts stale searches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);
  async function load(abort: AbortController) {
    setBusy(true);
    setMessage("최근 1년 거래에서 면적을 찾고 있습니다…");
    setScanned(0);
    setAreas(current ? [current] : []);
    setValue(current ? String(current) : "");
    setAptSeq(existingAptSeq ?? "");
    try {
      if (!supabase) throw new Error("면적 목록을 불러오려면 로그인해 주세요.");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("면적 목록을 불러오려면 로그인해 주세요.");
      const now = new Date();
      const end = now.getUTCFullYear() * 12 + now.getUTCMonth();
      const months = Array.from({ length: 12 }, (_, i) => {
        const serial = end - i;
        return `${Math.floor(serial / 12)}-${String((serial % 12) + 1).padStart(2, "0")}`;
      });
      const foundAreas: number[] = [];
      let foundAptSeq = "";
      for (let offset = 0; offset < months.length; offset += 4) {
        const batch = months.slice(offset, offset + 4);
        const results = await Promise.all(
          batch.map(async (month) => {
            const res = await fetch("/api/areas", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                district,
                dong,
                name: name.trim(),
                month,
                aptSeq: existingAptSeq || undefined,
                jibunAddress,
              }),
              signal: abort.signal,
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
            return result;
          }),
        );
        if (abort.signal.aborted) return;
        for (const result of results) {
          foundAreas.push(...(result.areas as number[]));
          if (!foundAptSeq && result.aptSeq) foundAptSeq = String(result.aptSeq);
        }
        setScanned(Math.min(offset + batch.length, months.length));
      }
      const next = [
        ...new Set([
          ...(current ? [current] : []),
          ...foundAreas.map(areaGroup).filter(Number.isFinite),
        ]),
      ].sort((a, b) => a - b);
      setAreas(next);
      if (foundAptSeq) setAptSeq(foundAptSeq);
      setMessage(
        next.length
          ? "면적을 선택해 주세요."
          : "최근 1년 거래에서 선택 가능한 면적을 찾지 못했습니다.",
      );
    } catch (e) {
      if (!abort.signal.aborted)
        setMessage(e instanceof Error ? e.message : "면적을 불러오지 못했습니다.");
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="property-area">
      <input type="hidden" name="apt_seq" value={aptSeq} />
      <label>
        전용면적 (㎡)
        <select
          name="area"
          required
          disabled={busy || !identity}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        >
          <option value="">
            {busy
              ? "면적을 불러오는 중…"
              : identity
                ? "면적을 선택하세요"
                : "아파트를 먼저 선택하세요"}
          </option>
          {areas.map((area) => (
            <option key={area} value={area}>
              {area}㎡{area === current ? " (현재 등록)" : ""}
            </option>
          ))}
        </select>
      </label>
      <p className="muted">
        소수점 아래를 버려 묶습니다. 예: 59.1~59.99㎡ → 59㎡. 거래가 없는 타입은 목록에 없을 수
        있습니다. 공급면적·평형과는 다릅니다.
      </p>
      {message && (
        <p className="muted" role="status">
          {message}
        </p>
      )}
      {scanned > 0 && (
        <p className="muted">
          최근 {scanned}개월 확인 · {areas.length}개 면적{aptSeq ? " · 실거래 단지 연결됨" : ""}
        </p>
      )}
    </div>
  );
}
