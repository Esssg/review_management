/**
 * 주문 상세 화면에서 Android 하드웨어 뒤로가기 시
 * 저장되지 않은 변경이 있으면 폼에서 먼저 처리할 수 있도록 핸들러를 등록합니다.
 */
export type OrderDetailBackResult = "proceed-with-back" | "handled" | "cancelled";

let backHandler: (() => Promise<OrderDetailBackResult>) | null = null;

export function setOrderDetailBackHandler(handler: (() => Promise<OrderDetailBackResult>) | null) {
  backHandler = handler;
}

export function getOrderDetailBackHandler() {
  return backHandler;
}
