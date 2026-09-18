export type Profile = {
  user_id?: string;
  nickname: string;
  created_at?: string;
  updated_at?: string;
};

export function normalizeNickname(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function nicknameValidation(value: string) {
  const nickname = normalizeNickname(value);
  if ([...nickname].length < 2) return "닉네임은 2자 이상 입력해 주세요.";
  if ([...nickname].length > 30) return "닉네임은 30자 이하로 입력해 주세요.";
  if (!/^[가-힣A-Za-z0-9 ]+$/.test(nickname))
    return "한글, 영문, 숫자와 띄어쓰기만 사용할 수 있습니다.";
  return null;
}

export function profileLabel(profile: Profile | null | undefined, _socialName?: string) {
  return profile?.nickname || "집 사용자";
}
