import Link from "next/link";
import { ChevronRight, Copy, Plus, Star, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import { type PurchaseTemplateRow } from "@/lib/kakao-purchase-paste";

const templateUpdatedFormatter = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" });

/** 민감한 원문 대신 템플릿에 채워진 항목 수만 보여줍니다. */
function countFilledTemplateFields(template: PurchaseTemplateRow) {
  return [
    template.buyer_name,
    template.recipient_name,
    template.login_id,
    template.phone,
    template.address,
    template.bank_account_number,
    template.account_holder,
  ].filter((value) => value?.trim()).length;
}

type TemplateAction = (template: PurchaseTemplateRow) => void | Promise<void>;

export function PurchaseTemplatesSettingsView({
  header,
  alerts,
  purchaseTemplates,
  defaultTemplateId,
  usageCounts,
  isTemplateUsageCountsLoaded,
  isLoadingTemplateUsageCounts,
  onSetDefault,
  onClone,
  onCopy,
  onDelete,
}: {
  header: ReactNode;
  alerts: ReactNode;
  purchaseTemplates: PurchaseTemplateRow[];
  defaultTemplateId: string | null;
  usageCounts: Record<string, number>;
  isTemplateUsageCountsLoaded: boolean;
  isLoadingTemplateUsageCounts: boolean;
  onSetDefault: (templateId: string | null) => void | Promise<void>;
  onClone: TemplateAction;
  onCopy: TemplateAction;
  onDelete: TemplateAction;
}) {
  return (
    <div className="flex flex-col gap-4">
      {header}
      {alerts}
      <section className="rounded-lg border border-hairline bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <p className="text-muted-foreground text-xs">
            카톡방에 붙여넣을 내용을 미리 저장해 둡니다. 목록에는 제목만 보이며, 복사하기는 주문번호·금액 없이 한 줄로 복사합니다.
          </p>
          <Link
            href="/settings/purchase-templates/new"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" aria-hidden />
            추가하기
          </Link>
        </div>
        <div className="flex flex-col gap-1">
          {purchaseTemplates.length === 0 ? (
            <p className="text-muted-foreground text-sm">저장된 템플릿이 없습니다.</p>
          ) : (
            purchaseTemplates.map((template) => (
              <div
                key={template.id}
                className="flex min-h-11 flex-col gap-2 rounded-xl border px-3 py-2.5 sm:flex-row sm:items-center"
              >
                <Link
                  href={`/settings/purchase-templates/detail?id=${encodeURIComponent(template.id)}`}
                  className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium transition-colors hover:bg-muted/50 active:bg-muted/70"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate">{template.title}</span>
                      {defaultTemplateId === template.id ? <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" aria-label="기본 템플릿" /> : null}
                    </span>
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      입력 {countFilledTemplateFields(template)}개 · {isTemplateUsageCountsLoaded ? `주문 ${usageCounts[template.id] ?? 0}건` : isLoadingTemplateUsageCounts ? "주문 사용량 조회 중…" : "주문 사용량 —"} · {templateUpdatedFormatter.format(new Date(template.updated_at))} 수정
                    </span>
                  </span>
                  <ChevronRight className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden />
                </Link>
                <div className="grid grid-cols-4 gap-1.5 sm:flex sm:shrink-0">
                  <button type="button" onClick={() => void onSetDefault(defaultTemplateId === template.id ? null : template.id)} className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-medium hover:bg-muted" title="새 주문 기본 템플릿">
                    <Star className="h-3.5 w-3.5" aria-hidden /> 기본
                  </button>
                  <button type="button" onClick={() => void onClone(template)} className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-medium hover:bg-muted" title="템플릿 복제">
                    <Copy className="h-3.5 w-3.5" aria-hidden /> 복제
                  </button>
                  <button type="button" onClick={() => void onCopy(template)} className="min-h-9 rounded-lg border px-2 text-xs font-medium hover:bg-muted" title="카톡 한 줄 복사">내용 복사</button>
                  <button type="button" onClick={() => void onDelete(template)} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-destructive/30 px-2 text-xs font-medium text-destructive hover:bg-destructive/10" title="템플릿 삭제">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
