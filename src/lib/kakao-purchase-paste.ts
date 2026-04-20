import type { Database } from "@/types/database";

export type PurchaseTemplateRow = Database["public"]["Tables"]["purchase_info_templates"]["Row"];

/** 카톡 한 줄 붙여넣기용 금액 (구매가격 입력값 기준) */
export function formatKakaoPasteAmount(purchasePriceRaw: string) {
  const trimmed = String(purchasePriceRaw ?? "").trim();
  if (!trimmed) return "";
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return trimmed;
  return `${n.toLocaleString("ko-KR")}원`;
}

/**
 * 주문번호/구매자/수취인/아이디/연락처/주소/은행계좌번호 예금주/금액
 * (주문번호·금액은 빈 문자열이면 해당 칸 비움)
 */
export function buildKakaoPasteLine(
  template: PurchaseTemplateRow,
  orderNumberRaw: string,
  purchasePriceRaw: string,
) {
  const orderNum = orderNumberRaw.trim();
  const amount = formatKakaoPasteAmount(purchasePriceRaw);
  const bankPart = [template.bank_account_number?.trim() ?? "", template.account_holder?.trim() ?? ""]
    .filter(Boolean)
    .join(" ");
  const addressOneLine = (template.address?.trim() ?? "").replace(/\s+/g, " ").replace(/\r?\n/g, " ");
  return [
    orderNum,
    template.buyer_name?.trim() ?? "",
    template.recipient_name?.trim() ?? "",
    template.login_id?.trim() ?? "",
    template.phone?.trim() ?? "",
    addressOneLine,
    bankPart,
    amount,
  ].join("/");
}
