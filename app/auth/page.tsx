"use client";
import { useEffect, useRef, useState } from "react";
import { Layers, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { SocialProvider, ProviderAvailability, authError, oauthCallbackError } from "@/lib/auth";

const names: Record<SocialProvider, string> = { google: "Google", kakao: "카카오" };
const localSupabase = /^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
);
export default function AuthPage() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<SocialProvider | "local" | null>(null);
  const [providers, setProviders] = useState<ProviderAvailability | null>(null);
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(false);
  const requestInFlight = useRef(false);
  async function loadProviders(signal?: AbortSignal) {
    setChecking(true);
    try {
      const response = await fetch("/api/auth/providers", { cache: "no-store", signal });
      const result = await response.json();
      if (signal?.aborted) return;
      if (!response.ok) {
        setProviders(null);
        setMessage(result.error);
        return;
      }
      setProviders(result);
    } catch {
      if (!signal?.aborted) {
        setProviders(null);
        setMessage("로그인 서비스에 연결하지 못했습니다. 다시 시도해 주세요.");
      }
    } finally {
      if (!signal?.aborted) setChecking(false);
    }
  }
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const callbackError = oauthCallbackError(window.location.search, window.location.hash);
    const callback = new URLSearchParams(window.location.search).get("mode") === "callback";
    if (callbackError) {
      setMessage(callbackError);
      window.history.replaceState(null, "", "/auth");
    }
    if (!supabase) {
      setReady(true);
      return;
    }
    if (!localSupabase) void loadProviders(controller.signal);
    // Supabase JS consumes the implicit OAuth fragment and persists its session.
    // Navigate only after initialization, never from inside the auth lock callback.
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          setMessage(authError(error));
          window.history.replaceState(null, "", "/auth");
        } else if (data.session && !callbackError) {
          window.location.replace("/");
          return;
        } else if (callback && !callbackError) {
          setMessage("로그인 정보를 확인할 수 없습니다. 아래 버튼으로 다시 시작해 주세요.");
          window.history.replaceState(null, "", "/auth");
        }
        setReady(true);
      })
      .catch(() => {
        if (alive) {
          setReady(true);
          setMessage("로그인 상태를 확인하지 못했습니다. 다시 시도해 주세요.");
        }
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, []);
  async function signIn(provider: SocialProvider) {
    if (!supabase || requestInFlight.current || !providers?.[provider]) return;
    requestInFlight.current = true;
    setBusy(provider);
    setMessage("");
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth?mode=callback`,
          skipBrowserRedirect: true,
        },
      });
      if (error) {
        setMessage(authError(error));
        return;
      }
      if (!data.url) {
        setMessage("로그인 주소를 받지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      window.location.assign(data.url);
    } catch {
      setMessage("로그인을 시작하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.");
    } finally {
      requestInFlight.current = false;
      setBusy(null);
    }
  }
  async function signInLocal() {
    if (!supabase || requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy("local");
    setMessage("");
    try {
      const response = await fetch("/api/auth/local", { method: "POST" }),
        result = await response.json();
      if (!response.ok) {
        setMessage(result.error || "로컬 개발 계정을 준비하지 못했습니다.");
        return;
      }
      const { error } = await supabase.auth.setSession({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      });
      if (error) {
        setMessage(authError(error));
        return;
      }
      window.location.replace("/");
    } catch {
      setMessage("로컬 개발 계정을 만들지 못했습니다. Supabase 실행 상태를 확인해 주세요.");
    } finally {
      requestInFlight.current = false;
      setBusy(null);
    }
  }
  return (
    <main className="auth-page">
      <a href="/" className="brand">
        <span className="brand-icon">
          <Layers size={23} />
        </span>
        집업
      </a>
      <section className="panel auth-card">
        <div className="eyebrow">MY REAL ESTATE TRACKER</div>
        <h1>나의 다음 집에 한 걸음</h1>
        <p className="auth-description">
          {localSupabase ? (
            <>
              운영 데이터와 분리된 로컬 환경입니다.
              <br />
              테스트 기록은 이 컴퓨터에만 남습니다.
            </>
          ) : (
            <>
              평소 쓰는 계정으로 시작하세요.
              <br />
              처음이라면 가입까지 한 번에 완료됩니다.
            </>
          )}
        </p>
        {!ready ? (
          <p role="status">로그인 상태 확인 중…</p>
        ) : !supabase ? (
          <p className="notice">
            계정 서비스가 아직 연결되지 않았습니다. 운영자에게 문의해 주세요.
          </p>
        ) : localSupabase ? (
          <div className="social-options">
            <button
              className="social-button local-dev"
              disabled={busy !== null}
              onClick={signInLocal}
            >
              {busy === "local" ? "로컬 계정 생성 중…" : "로컬 개발 계정으로 시작"}
            </button>
            <p className="provider-note">
              이 계정과 기록은 내 컴퓨터의 로컬 Supabase에만 저장됩니다.
            </p>
          </div>
        ) : (
          <div className="social-options">
            {(["google", "kakao"] as SocialProvider[]).map((provider) => (
              <div key={provider}>
                <button
                  className={`social-button ${provider}`}
                  disabled={!providers?.[provider] || checking || busy !== null}
                  onClick={() => signIn(provider)}
                >
                  {busy === provider ? "로그인 화면으로 이동 중…" : `${names[provider]}로 계속하기`}
                </button>
                {providers && !providers[provider] && (
                  <p className="provider-note">{names[provider]} 로그인 연결 준비 중</p>
                )}
              </div>
            ))}
            {checking && (
              <p className="provider-note" role="status">
                로그인 서비스 확인 중…
              </p>
            )}
            {(!providers || !providers.google || !providers.kakao) && !checking && (
              <button
                className="button"
                disabled={busy !== null}
                onClick={() => {
                  setMessage("");
                  void loadProviders();
                }}
              >
                연결 상태 다시 확인
              </button>
            )}
          </div>
        )}
        {message && (
          <p className="notice auth-error" role="alert">
            {message}
          </p>
        )}
        <div className="auth-switch">
          나의 단지와 가격 기록은 내 계정에 저장됩니다.
          <p className="provider-note">
            기존 기록을 보려면 이전에 사용한 로그인 계정을 선택하세요.
          </p>
        </div>
      </section>
      <a className="auth-back" href="/">
        <ArrowLeft size={15} />
        먼저 둘러보기
      </a>
    </main>
  );
}
