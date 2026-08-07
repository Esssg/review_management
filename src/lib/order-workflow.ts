import { getKoreaDateInputValue } from "./korea-date";

export type PurchaseScheduleFilter = "scheduleToday" | "overdue" | "scheduleUpcoming";

/** 중복 주문 비교에서 공백·대소문자 차이만 있는 상품명을 같은 값으로 봅니다. */
export function normalizeOrderMatchText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
}

/** 구매 예정 시각을 오늘·기한 경과·7일 이내 조건에 맞춰 판정합니다. */
export function matchesPurchaseSchedule(
  scheduledPurchaseAt: string | null,
  filter: PurchaseScheduleFilter,
  referenceTime: number,
) {
  if (!scheduledPurchaseAt) return false;
  const schedule = new Date(scheduledPurchaseAt);
  const scheduleTime = schedule.getTime();
  if (Number.isNaN(scheduleTime)) return false;

  if (filter === "scheduleToday") {
    return getKoreaDateInputValue(schedule) === getKoreaDateInputValue(new Date(referenceTime));
  }
  if (filter === "overdue") return scheduleTime < referenceTime;

  const upcomingLimit = referenceTime + 7 * 24 * 60 * 60 * 1000;
  return scheduleTime >= referenceTime && scheduleTime <= upcomingLimit;
}
