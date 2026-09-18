"use client";
import { MessageSquareText } from "lucide-react";

export function SupportForm({ loggedIn }: { loggedIn: boolean; screen?: string }) {
  return (
    <section className="panel settings-panel support-panel">
      <MessageSquareText size={25} />
      <h2>문의</h2>
      <p>오류 제보, 기능 제안, 사용 문의를 남기고 답변을 확인할 수 있습니다.</p>
      {loggedIn ? (
        <a className="button primary" href="/support">
          문의함 열기
        </a>
      ) : (
        <a className="button primary" href="/auth">
          로그인 · 회원가입
        </a>
      )}
    </section>
  );
}
