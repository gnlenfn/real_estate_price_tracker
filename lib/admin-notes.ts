export function validateAdminNote(value: string) {
  const body = value.trim();
  if (!body) return "내부 메모를 입력해 주세요.";
  if (body.length > 4000) return "내부 메모는 4,000자 이내로 입력해 주세요.";
  return null;
}
