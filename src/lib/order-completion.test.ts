import { describe, expect, it } from "vitest";

import {
  buildOrderCompletionValues,
  getDefaultOrderCompletionInput,
  getOrderCompletionWarning,
  parseOrderCompletionAmount,
} from "./order-completion";
import type { OrderWithRelations } from "@/types/orders";

// 완료 규칙에 필요한 값만 명시해 단건·일괄 처리가 같은 결과인지 검증합니다.
const baseOrder = {
  id: "order-1",
  title: "공구방",
  product_name: "테스트 상품",
  purchase_price_krw: 10_000,
  deposit_date: null,
  deposit_amount_krw: null,
  deposit_memo: null,
  is_item_delivered: false,
} as OrderWithRelations;

describe("주문 완료 입력", () => {
  it("쉼표가 있는 0 이상의 입금액만 숫자로 바꾼다", () => {
    expect(parseOrderCompletionAmount("12,500")).toBe(12_500);
    expect(parseOrderCompletionAmount("-1")).toBeNull();
    expect(parseOrderCompletionAmount("금액")).toBeNull();
  });

  it("기존 입금값이 없으면 구매금액과 주문 제목을 기본값으로 사용한다", () => {
    const input = getDefaultOrderCompletionInput(baseOrder);
    expect(input.amount).toBe("10000");
    expect(input.memo).toBe("공구방");
  });

  it("미배송 전액 입금과 배송 후 차액 입금을 경고한다", () => {
    expect(getOrderCompletionWarning(baseOrder, 10_000)).toContain("미배송");
    expect(getOrderCompletionWarning({ ...baseOrder, is_item_delivered: true }, 9_000)).toContain("배송 상품");
    expect(getOrderCompletionWarning({ ...baseOrder, is_item_delivered: true }, 10_000)).toBeNull();
  });

  it("검증된 완료 값과 수익을 만든다", () => {
    const result = buildOrderCompletionValues(baseOrder, {
      date: "2026-08-08",
      amount: "12,000",
      memo: " 입금 확인 ",
    });
    expect(result).toMatchObject({
      values: {
        is_processed: true,
        deposit_date: "2026-08-08",
        deposit_amount_krw: 12_000,
        deposit_memo: "입금 확인",
        profit_krw: 2_000,
      },
    });
  });
});
