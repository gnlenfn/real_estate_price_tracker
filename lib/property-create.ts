import { syncMonths } from "./trade-sync";

export function tradeMonthsForNewProperty(
  editing: boolean,
  start: string,
  end: string,
  currentMonth: string,
) {
  if (editing) return [];
  if (end > currentMonth) throw new Error("종료 월은 이번 달까지 선택해 주세요.");
  return syncMonths(start, end);
}
