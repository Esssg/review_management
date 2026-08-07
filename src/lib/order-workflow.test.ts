import { describe, expect, it } from "vitest";

import { getKoreaDateInputValue } from "./korea-date";
import { matchesPurchaseSchedule, normalizeOrderMatchText } from "./order-workflow";

describe("한국 시간 날짜 처리", () => {
  it("UTC 날짜가 달라도 한국 달력 날짜를 반환한다", () => {
    expect(getKoreaDateInputValue(new Date("2026-08-08T16:00:00.000Z"))).toBe("2026-08-09");
  });
});

describe("주문 중복 비교", () => {
  it("앞뒤·연속 공백과 영문 대소문자를 정규화한다", () => {
    expect(normalizeOrderMatchText("  Apple   Watch ")).toBe("apple watch");
  });
});

describe("구매 예정 필터", () => {
  const referenceTime = new Date("2026-08-08T03:00:00.000Z").getTime();

  it("한국 기준 같은 날의 일정을 오늘 일정으로 찾는다", () => {
    expect(matchesPurchaseSchedule("2026-08-08T14:00:00.000Z", "scheduleToday", referenceTime)).toBe(true);
  });

  it("현재보다 지난 일정만 기한 경과로 찾는다", () => {
    expect(matchesPurchaseSchedule("2026-08-08T02:59:59.000Z", "overdue", referenceTime)).toBe(true);
    expect(matchesPurchaseSchedule("2026-08-08T03:00:01.000Z", "overdue", referenceTime)).toBe(false);
  });

  it("현재부터 7일 안의 미래 일정만 다가오는 일정으로 찾는다", () => {
    expect(matchesPurchaseSchedule("2026-08-15T03:00:00.000Z", "scheduleUpcoming", referenceTime)).toBe(true);
    expect(matchesPurchaseSchedule("2026-08-15T03:00:01.000Z", "scheduleUpcoming", referenceTime)).toBe(false);
    expect(matchesPurchaseSchedule(null, "scheduleUpcoming", referenceTime)).toBe(false);
  });
});
