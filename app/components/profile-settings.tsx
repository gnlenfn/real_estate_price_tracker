"use client";
import { useEffect, useState, FormEvent } from "react";
import { UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { nicknameValidation, normalizeNickname, type Profile } from "@/lib/profile";

export function ProfileSettings({
  profile,
  onSaved,
}: {
  profile: Profile | null;
  onSaved: (profile: Profile) => void;
}) {
  const [nickname, setNickname] = useState(profile?.nickname || ""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => setNickname(profile?.nickname || ""), [profile?.nickname]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = normalizeNickname(nickname),
      validation = nicknameValidation(next);
    setMessage("");
    if (validation) {
      setMessage(validation);
      return;
    }
    if (!supabase || !profile) {
      setMessage("프로필을 불러온 뒤 다시 시도해 주세요.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("profiles")
      .update({ nickname: next, updated_at: new Date().toISOString() })
      .eq("user_id", profile.user_id)
      .select("*")
      .single();
    setBusy(false);
    if (error) {
      setMessage(
        error.code === "23505"
          ? "이미 사용 중인 닉네임입니다. 다른 이름을 입력해 주세요."
          : "닉네임을 저장하지 못했습니다. 다시 시도해 주세요.",
      );
      return;
    }
    onSaved(data as Profile);
    setMessage("닉네임을 변경했습니다.");
  }
  return (
    <section className="panel settings-panel">
      <UserRound size={25} />
      <h2>앱 닉네임</h2>
      <p>소셜 계정 이름과 별도로 사용합니다. 다른 사용자와 중복되지 않는 이름이어야 합니다.</p>
      {profile ? (
        <form className="settings-form" onSubmit={save}>
          <label>
            닉네임
            <input
              value={nickname}
              maxLength={30}
              onChange={(event) => setNickname(event.target.value)}
              required
            />
          </label>
          <button className="button" disabled={busy}>
            {busy ? "저장 중…" : "닉네임 변경"}
          </button>
          {message && (
            <span className="form-message" role="status">
              {message}
            </span>
          )}
        </form>
      ) : (
        <div className="connection">닉네임을 준비하고 있습니다.</div>
      )}
    </section>
  );
}
