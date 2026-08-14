import { describe, expect, it } from "vitest";

import { buildKakaoPasteLine, formatKakaoPasteAmount } from "./kakao-purchase-paste";
import type { PurchaseTemplateRow } from "./kakao-purchase-paste";

const template = {
  id: "template-1",
  user_id: "user-1",
  title: "기본 템플릿",
  buyer_name: "구매자",
  recipient_name: "수취인",
  login_id: "아이디",
  phone: "010-0000-0000",
  address: "서울시",
  bank_account_number: "123456",
  account_holder: "예금주",
  created_at: "2026-08-14T00:00:00.000Z",
  updated_at: "2026-08-14T00:00:00.000Z",
} satisfies PurchaseTemplateRow;

describe("카카오톡 구매 정보 한 줄", () => {
  it("구매금액에서 쉼표와 원 단위를 제거한다", () => {
    expect(formatKakaoPasteAmount("12,500")).toBe("12500");
    expect(formatKakaoPasteAmount("12500")).toBe("12500");
  });

  it("한 줄의 마지막 칸에 숫자만 넣는다", () => {
    expect(buildKakaoPasteLine(template, "주문-1", "12,500").split("/").at(-1)).toBe("12500");
  });
});
