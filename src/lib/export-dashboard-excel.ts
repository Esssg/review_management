import * as XLSX from "xlsx";

import type { OrderWithRelations } from "@/components/orders/orders-table";

function toNum(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function emptyIfZero(v: string | number | null | undefined): number | string {
  const n = toNum(v);
  return n === 0 ? "" : n;
}

export function exportDashboardExcel(orders: OrderWithRelations[], userEmail: string) {
  const wb = XLSX.utils.book_new();
  const now = new Date();
  const nowStr = now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const dateStr = now.toISOString().slice(0, 10);

  // ─────────────────────────────────────────
  // Sheet 1: 대시보드
  // ─────────────────────────────────────────
  const d: (string | number)[][] = [];

  d.push(["리뷰 매니저 대시보드"]);
  d.push([`내보내기 일시: ${nowStr}`]);
  d.push([`계정: ${userEmail}`]);
  d.push([]);

  // KPI
  const totalPurchaseAmount = orders.reduce((s, o) => s + toNum(o.purchase_price_krw), 0);
  const totalDepositAmount = orders.reduce((s, o) => s + toNum(o.deposit_amount_krw), 0);
  const unrecoveredPrincipal = orders
    .filter((o) => !o.is_processed)
    .reduce((s, o) => s + toNum(o.purchase_price_krw), 0);
  const pendingCount = orders.filter((o) => !o.is_processed).length;

  d.push(["■ 현황 요약 (전체 기간)"]);
  d.push(["항목", "값"]);
  d.push(["누적 구매금액 (원)", totalPurchaseAmount]);
  d.push(["누적 입금금액 (원)", totalDepositAmount]);
  d.push(["미회수 원금 (원)", unrecoveredPrincipal]);
  d.push(["미완료 건수", pendingCount]);
  d.push([]);

  // Monthly stats
  const monthMap = new Map<
    string,
    { purchaseAmount: number; profitKrw: number; total: number; completed: number }
  >();
  orders.forEach((o) => {
    const month = o.purchase_date.slice(0, 7);
    const prev = monthMap.get(month) ?? {
      purchaseAmount: 0,
      profitKrw: 0,
      total: 0,
      completed: 0,
    };
    prev.purchaseAmount += toNum(o.purchase_price_krw);
    prev.profitKrw += toNum(o.profit_krw);
    prev.total += 1;
    if (o.is_processed) prev.completed += 1;
    monthMap.set(month, prev);
  });
  const monthlyStats = [...monthMap.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  d.push(["■ 월별 요약 통계"]);
  d.push(["월", "구매금액 (원)", "수익 (원)", "전체 건수", "완료 건수"]);
  monthlyStats.forEach(([month, stat]) => {
    d.push([month, stat.purchaseAmount, stat.profitKrw, stat.total, stat.completed]);
  });
  d.push([]);

  // Grouped stats helper
  const buildGroup = (keySelector: (o: OrderWithRelations) => string) => {
    const map = new Map<
      string,
      { purchaseAmount: number; depositAmount: number; profitKrw: number }
    >();
    orders.forEach((o) => {
      const key = keySelector(o) || "미지정";
      const prev = map.get(key) ?? { purchaseAmount: 0, depositAmount: 0, profitKrw: 0 };
      prev.purchaseAmount += toNum(o.purchase_price_krw);
      prev.depositAmount += toNum(o.deposit_amount_krw);
      prev.profitKrw += toNum(o.profit_krw);
      map.set(key, prev);
    });
    return [...map.entries()].sort((a, b) => b[1].purchaseAmount - a[1].purchaseAmount);
  };

  const byPlatform = buildGroup((o) => o.platforms?.name ?? "미지정");
  const byMethod = buildGroup((o) => o.payment_methods?.name ?? "미지정");
  const byAccount = buildGroup((o) => o.buyer_accounts?.label ?? "미지정");

  d.push(["■ 플랫폼별 집계"]);
  d.push(["플랫폼", "구매금액 (원)", "입금금액 (원)", "수익 (원)"]);
  byPlatform.forEach(([key, s]) => d.push([key, s.purchaseAmount, s.depositAmount, s.profitKrw]));
  d.push([]);

  d.push(["■ 결제방식별 집계"]);
  d.push(["결제방식", "구매금액 (원)", "입금금액 (원)", "수익 (원)"]);
  byMethod.forEach(([key, s]) => d.push([key, s.purchaseAmount, s.depositAmount, s.profitKrw]));
  d.push([]);

  d.push(["■ 구매계정별 집계"]);
  d.push(["구매계정", "구매금액 (원)", "입금금액 (원)", "수익 (원)"]);
  byAccount.forEach(([key, s]) => d.push([key, s.purchaseAmount, s.depositAmount, s.profitKrw]));

  const ws1 = XLSX.utils.aoa_to_sheet(d);
  ws1["!cols"] = [{ wch: 28 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws1, "대시보드");

  // ─────────────────────────────────────────
  // Sheet 2: 구매장부 전체
  // ─────────────────────────────────────────
  const headers = [
    "구매일",
    "상품명",
    "플랫폼",
    "결제방식",
    "구매계정",
    "주문번호",
    "구매금액(원)",
    "입금금액(원)",
    "수익(원)",
    "완료여부",
    "배송완료",
    "주문상태",
    "제목",
    "입금일",
    "예정구매일",
    "입금메모",
    "비고",
    "상품URL",
    "리뷰사진수",
    "리뷰글자수",
    "AI리뷰",
    "생성일시",
    "수정일시",
    "주문ID",
  ];

  const orderRows = orders.map((o) => [
    o.purchase_date,
    o.product_name,
    o.platforms?.name ?? "",
    o.payment_methods?.name ?? "",
    o.buyer_accounts?.label ?? "",
    o.order_number ?? "",
    toNum(o.purchase_price_krw),
    emptyIfZero(o.deposit_amount_krw),
    emptyIfZero(o.profit_krw),
    o.is_processed ? "완료" : "미완료",
    o.is_item_delivered ? "예" : "아니오",
    o.order_status ?? "",
    o.title ?? "",
    o.deposit_date ?? "",
    o.scheduled_purchase_at ?? "",
    o.deposit_memo ?? "",
    o.notes ?? "",
    o.product_url ?? "",
    o.review_photo_count ?? "",
    o.review_char_count ?? "",
    o.ai_review ?? "",
    o.created_at,
    o.updated_at,
    o.id,
  ]);

  const ws2 = XLSX.utils.aoa_to_sheet([headers, ...orderRows]);
  ws2["!cols"] = [
    { wch: 12 }, // 구매일
    { wch: 32 }, // 상품명
    { wch: 14 }, // 플랫폼
    { wch: 14 }, // 결제방식
    { wch: 16 }, // 구매계정
    { wch: 18 }, // 주문번호
    { wch: 14 }, // 구매금액
    { wch: 14 }, // 입금금액
    { wch: 12 }, // 수익
    { wch: 10 }, // 완료여부
    { wch: 10 }, // 배송완료
    { wch: 12 }, // 주문상태
    { wch: 20 }, // 제목
    { wch: 12 }, // 입금일
    { wch: 14 }, // 예정구매일
    { wch: 20 }, // 입금메모
    { wch: 24 }, // 비고
    { wch: 36 }, // 상품URL
    { wch: 10 }, // 리뷰사진수
    { wch: 10 }, // 리뷰글자수
    { wch: 40 }, // AI리뷰
    { wch: 20 }, // 생성일시
    { wch: 20 }, // 수정일시
    { wch: 38 }, // 주문ID
  ];
  XLSX.utils.book_append_sheet(wb, ws2, "구매장부 전체");

  XLSX.writeFile(wb, `리뷰매니저_${dateStr}.xlsx`);
}
