import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import { buildKakaoPasteLine, type PurchaseTemplateRow } from "@/lib/kakao-purchase-paste";
import type { UserPreferences } from "@/lib/user-preferences";
import type { Database } from "@/types/database";

type SettingsPreferencesOptions = {
  userId: string;
  view: string;
  initialPurchaseTemplates: PurchaseTemplateRow[];
  templateUsageCounts: Record<string, number>;
  initialTemplateUsageCountsLoaded: boolean;
  onLoadTemplateUsageCounts: () => Promise<Record<string, number>>;
  initialPreferences: UserPreferences;
  supabase: SupabaseClient<Database>;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

/** 주문 기본값과 구매 정보 템플릿의 조회·저장 책임을 설정 부모에서 분리합니다. */
export function useSettingsPreferences({
  userId,
  view,
  initialPurchaseTemplates,
  templateUsageCounts,
  initialTemplateUsageCountsLoaded,
  onLoadTemplateUsageCounts,
  initialPreferences,
  supabase,
  onError,
  onSuccess,
}: SettingsPreferencesOptions) {
  const [purchaseTemplates, setPurchaseTemplates] = useState<PurchaseTemplateRow[]>(initialPurchaseTemplates);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [usageCounts, setUsageCounts] = useState(templateUsageCounts);
  const [isTemplateUsageCountsLoaded, setIsTemplateUsageCountsLoaded] = useState(initialTemplateUsageCountsLoaded);
  const [isLoadingTemplateUsageCounts, setIsLoadingTemplateUsageCounts] = useState(false);

  useEffect(() => {
    if (view !== "purchase-templates" || isTemplateUsageCountsLoaded) return;

    let cancelled = false;
    setIsLoadingTemplateUsageCounts(true);
    void (async () => {
      try {
        const nextCounts = await onLoadTemplateUsageCounts();
        if (!cancelled) {
          setUsageCounts(nextCounts);
          setIsTemplateUsageCountsLoaded(true);
        }
      } catch {
        if (!cancelled) setIsTemplateUsageCountsLoaded(true);
      } finally {
        if (!cancelled) setIsLoadingTemplateUsageCounts(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isTemplateUsageCountsLoaded, onLoadTemplateUsageCounts, view]);

  const updatePreferences = useCallback(async (
    patch: Database["public"]["Tables"]["user_preferences"]["Update"],
    successMessageText?: string,
  ) => {
    onError("");
    const { error } = await supabase.from("user_preferences").upsert(
      { user_id: userId, ...patch },
      { onConflict: "user_id" },
    );
    if (error) {
      onError(error.message);
      return false;
    }
    setPreferences((current) => ({ ...current, ...patch }));
    if (successMessageText) onSuccess(successMessageText);
    return true;
  }, [onError, onSuccess, supabase, userId]);

  const handleCopyPurchaseTemplate = useCallback(async (template: PurchaseTemplateRow) => {
    onError("");
    onSuccess("");
    const line = buildKakaoPasteLine(template, "", "");
    try {
      await copyTextToClipboard(line);
      onSuccess("클립보드에 복사했습니다. (주문번호·금액 칸은 비워 두었습니다.)");
    } catch {
      onError("복사에 실패했습니다. 브라우저의 클립보드 권한을 확인한 뒤 다시 시도해 주세요.");
    }
  }, [onError, onSuccess]);

  const clonePurchaseTemplate = useCallback(async (template: PurchaseTemplateRow) => {
    onError("");
    const { data, error } = await supabase
      .from("purchase_info_templates")
      .insert({
        user_id: userId,
        title: `${template.title} 복사본`,
        buyer_name: template.buyer_name,
        recipient_name: template.recipient_name,
        login_id: template.login_id,
        phone: template.phone,
        address: template.address,
        bank_account_number: template.bank_account_number,
        account_holder: template.account_holder,
      })
      .select("*")
      .single();
    if (error) {
      onError(error.message);
      return;
    }
    setPurchaseTemplates((current) => [data, ...current]);
    setUsageCounts((current) => ({ ...current, [data.id]: 0 }));
    onSuccess("템플릿 복사본을 만들었습니다.");
  }, [onError, onSuccess, supabase, userId]);

  const setDefaultPurchaseTemplate = useCallback(async (templateId: string | null) => {
    await updatePreferences(
      { default_purchase_info_template_id: templateId },
      templateId ? "기본 구매 정보 템플릿을 변경했습니다." : "기본 템플릿 지정을 해제했습니다.",
    );
  }, [updatePreferences]);

  const deletePurchaseTemplate = useCallback(async (template: PurchaseTemplateRow) => {
    const count = usageCounts[template.id] ?? 0;
    const confirmed = window.confirm(
      count > 0
        ? `"${template.title}" 템플릿은 주문 ${count}건에서 사용 중입니다. 삭제하면 주문과의 템플릿 연결이 해제됩니다. 삭제할까요?`
        : `"${template.title}" 템플릿을 삭제할까요?`,
    );
    if (!confirmed) return;

    const { error } = await supabase.from("purchase_info_templates").delete().eq("id", template.id);
    if (error) {
      onError(error.message);
      return;
    }
    setPurchaseTemplates((current) => current.filter((item) => item.id !== template.id));
    setUsageCounts((current) => {
      const next = { ...current };
      delete next[template.id];
      return next;
    });
    if (preferences.default_purchase_info_template_id === template.id) {
      setPreferences((current) => ({ ...current, default_purchase_info_template_id: null }));
    }
  }, [onError, preferences.default_purchase_info_template_id, supabase, usageCounts]);

  return {
    purchaseTemplates,
    preferences,
    usageCounts,
    isTemplateUsageCountsLoaded,
    isLoadingTemplateUsageCounts,
    updatePreferences,
    handleCopyPurchaseTemplate,
    clonePurchaseTemplate,
    setDefaultPurchaseTemplate,
    deletePurchaseTemplate,
  };
}
