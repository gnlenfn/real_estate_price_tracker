export const attachmentTypes = ["image/png", "image/jpeg", "image/webp"] as const;
export const maxAttachmentCount = 3;
export const maxAttachmentBytes = 5 * 1024 * 1024;
export type SupportStatus = "open" | "answered" | "closed";

export function validateAttachment(file: { type: string; size: number }) {
  if (!attachmentTypes.includes(file.type as (typeof attachmentTypes)[number]))
    return "PNG, JPEG, WebP 이미지만 첨부할 수 있습니다.";
  if (file.size > maxAttachmentBytes) return "이미지 한 개는 5MB 이하만 첨부할 수 있습니다.";
  return null;
}

export function validateAttachments(files: Array<{ type: string; size: number }>) {
  if (files.length > maxAttachmentCount) return "이미지는 최대 3개까지 첨부할 수 있습니다.";
  return files.map(validateAttachment).find(Boolean) || null;
}

export function appendAttachments<T>(current: T[], incoming: T[]) {
  return [...current, ...incoming].slice(0, maxAttachmentCount);
}

export const canReply = (status: SupportStatus) => status !== "closed";
export const supportStatusLabel = (status: SupportStatus) =>
  ({ open: "접수", answered: "답변 완료", closed: "종료" })[status];
