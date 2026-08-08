import { getKoreaDateInputValue } from "./korea-date";
import type { OrderWithRelations } from "../types/orders";

export type OrderCompletionInput = {
  date: string;
  amount: string;
  memo: string;
};

/** 사용자가 입력한 원화 금액에서 쉼표를 제거하고 안전한 숫자로 바꿉니다. */
export function parseOrderCompletionAmount(raw: string): number | null {
  const value = raw.trim().replace(/,/g, "");
  if (!value) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

/** 입금액과 구매액의 차이를 소수 둘째 자리까지 수익으로 저장합니다. */
export function calculateOrderProfit(deposit: number, purchase: number): number {
  return Math.round((deposit - purchase) * 100) / 100;
}

/** 단건·일괄 완료처리가 같은 기본값을 사용하도록 한 곳에서 계산합니다. */
export function getDefaultOrderCompletionInput(row: OrderWithRelations): OrderCompletionInput {
  return {
    date: row.deposit_date?.trim() || getKoreaDateInputValue(),
    amount: row.deposit_amount_krw != null ? String(row.deposit_amount_krw) : String(row.purchase_price_krw),
    memo: row.deposit_memo?.trim() ? row.deposit_memo : row.title?.trim() ?? "",
  };
}

/** 배송 상태와 입금액 조합이 평소 처리 기준과 다르면 완료 전에 확인 문구를 반환합니다. */
export function getOrderCompletionWarning(row: OrderWithRelations, depositAmount: number) {
  const purchaseAmount = Number(row.purchase_price_krw);
  if (!Number.isFinite(purchaseAmount)) return null;
  const isSameAmount = depositAmount === purchaseAmount;
  if (!row.is_item_delivered && isSameAmount) {
    return "미배송 상품인데 구매금액과 입금금액이 같습니다. 처리하시겠습니까?";
  }
  if (row.is_item_delivered && !isSameAmount) {
    return "배송 상품인데 구매금액과 입금금액이 다릅니다. 처리하시겠습니까?";
  }
  return null;
}

/** 화면 입력을 검증하고 Supabase 업데이트에 바로 쓸 완료 값을 만듭니다. */
export function buildOrderCompletionValues(row: OrderWithRelations, input: OrderCompletionInput) {
  const depositDate = input.date.trim();
  if (!depositDate) return { error: "입금일자를 입력해 주세요." } as const;

  const depositAmount = parseOrderCompletionAmount(input.amount);
  if (depositAmount === null) return { error: "입금금액을 0 이상의 숫자로 입력해 주세요." } as const;

  const purchaseAmount = Number(row.purchase_price_krw);
  if (!Number.isFinite(purchaseAmount)) return { error: "구매금액을 확인해 주세요." } as const;

  return {
    values: {
      is_processed: true,
      deposit_date: depositDate,
      deposit_amount_krw: depositAmount,
      deposit_memo: input.memo.trim() || null,
      profit_krw: calculateOrderProfit(depositAmount, purchaseAmount),
    },
    warning: getOrderCompletionWarning(row, depositAmount),
  } as const;
}
