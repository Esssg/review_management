"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { HexColorInput, HexColorPicker } from "react-colorful";
import { ArrowLeft, ChevronRight, Copy, Plus, Star, Trash2 } from "lucide-react";

import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import { normalizeHexColor } from "@/lib/color";
import { buildKakaoPasteLine, type PurchaseTemplateRow } from "@/lib/kakao-purchase-paste";
import { createClient } from "@/lib/supabase/client";
import type { OrderSaveAction, UserPreferences } from "@/lib/user-preferences";
import { cn } from "@/lib/utils";
import type { BuyerAccount, PaymentMethod, Platform } from "@/lib/master-data";
import type { Database } from "@/types/database";

type UserItemSetting = Database["public"]["Tables"]["user_item_settings"]["Row"];

export type SettingsPanelView =
  | "home"
  | "account"
  | "nickname"
  | "defaults"
  | "purchase-templates"
  | "ai"
  | "platforms"
  | "payment-methods"
  | "buyer-accounts";

type ItemWithMeta<T> = T & { isSystem: boolean; isHidden: boolean };

const DEFAULT_PLATFORM_COLOR = "#64748b";
const DEFAULT_PAYMENT_METHOD_COLOR = "#7c3aed";
const DEFAULT_BUYER_ACCOUNT_COLOR = "#64748b";
const templateUpdatedFormatter = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" });
const COLOR_PRESETS = [
  "#f97316",
  "#16a34a",
  "#ca8a04",
  "#dc2626",
  "#2563eb",
  "#7c3aed",
  "#0891b2",
  "#e11d48",
  "#64748b",
] as const;

/** 민감한 원문 대신 채워진 항목 수만 목록에 보여줍니다. */
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

const VIEW_TITLES: Record<Exclude<SettingsPanelView, "home">, string> = {
  account: "계정",
  nickname: "닉네임 변경",
  defaults: "주문 기본값",
  "purchase-templates": "구매 정보 템플릿",
  ai: "AI 설정 관리",
  platforms: "결제 플랫폼 관리",
  "payment-methods": "결제 수단 관리",
  "buyer-accounts": "구매 계정 관리",
};

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-ink-muted mt-0.5 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function ItemRow({
  label,
  color,
  isSystem,
  isHidden,
  canEditColor,
  isDeleting,
  isSavingColor,
  onDelete,
  onChangeColor,
}: {
  label: string;
  color: string;
  isSystem: boolean;
  isHidden: boolean;
  canEditColor: boolean;
  isDeleting: boolean;
  isSavingColor: boolean;
  onDelete: () => void;
  onChangeColor: (next: string) => Promise<void>;
}) {
  const normalizedColor = normalizeHexColor(color, DEFAULT_PLATFORM_COLOR);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [draftColor, setDraftColor] = useState(normalizedColor);
  const paletteRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!paletteOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!paletteRef.current?.contains(event.target as Node)) {
        setPaletteOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [paletteOpen]);

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        isHidden && "opacity-50",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20"
            style={{ backgroundColor: normalizedColor }}
            aria-hidden
          />
          <span className="truncate text-sm">{label}</span>
          {isSystem && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-700 dark:text-slate-400">
              기본
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {canEditColor ? (
            <div className="relative" ref={paletteRef}>
              <button
                type="button"
                disabled={isSavingColor}
                onClick={() => {
                  // 색상 선택기를 열 때 저장된 색상으로 초안을 맞춰 취소 후에도 현재 값이 보이게 합니다.
                  setDraftColor(normalizedColor);
                  setPaletteOpen((prev) => !prev);
                }}
                className={cn(
                  "h-8 w-8 rounded-full border-2 border-white shadow ring-1 ring-black/12 transition-transform hover:scale-105 dark:border-slate-800 dark:ring-white/20",
                  isSavingColor && "cursor-not-allowed opacity-60",
                )}
                style={{ backgroundColor: normalizedColor }}
                aria-label={`${label} 색상 선택`}
                title="색상 변경"
              />
              {paletteOpen ? (
                <div className="absolute right-0 top-10 z-20 w-52 rounded-xl border bg-popover p-2 shadow-lg">
                  <div className="mb-1 text-[11px] font-medium text-muted-foreground">추천 색상</div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={cn(
                          "h-7 w-7 rounded-full ring-1 ring-black/10 transition-transform hover:scale-105 dark:ring-white/20",
                          normalizedColor === preset && "ring-2 ring-offset-2 ring-offset-background",
                        )}
                        style={{ backgroundColor: preset }}
                        onClick={() => {
                          void onChangeColor(preset);
                          setPaletteOpen(false);
                        }}
                        disabled={isSavingColor}
                        aria-label={`${label} 색상 ${preset}`}
                        title={preset}
                      />
                    ))}
                  </div>
                  <div className="mt-2 border-t pt-2">
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground">직접 선택</p>
                    <HexColorPicker
                      color={draftColor}
                      onChange={(next) => setDraftColor(next)}
                      style={{ width: "100%", height: 120 }}
                    />
                    <HexColorInput
                      color={draftColor}
                      onChange={(next) => setDraftColor(normalizeHexColor(next, draftColor))}
                      prefixed
                      className={cn(
                        "h-8 w-full rounded-md border border-input bg-background px-2 text-xs uppercase",
                        isSavingColor && "opacity-60",
                      )}
                    />
                    <button
                      type="button"
                      className="h-8 w-full rounded-md bg-primary text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                      disabled={isSavingColor || normalizeHexColor(draftColor, normalizedColor) === normalizedColor}
                      onClick={() => void onChangeColor(normalizeHexColor(draftColor, normalizedColor))}
                    >
                      적용
                    </button>
                  </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            disabled={isDeleting}
            onClick={onDelete}
            className={cn(
              "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
              isHidden
                ? "border-slate-300 bg-background text-slate-600 hover:bg-muted dark:border-slate-600 dark:text-slate-400"
                : "border-destructive bg-destructive text-white hover:bg-destructive/90 dark:border-destructive dark:bg-destructive dark:hover:bg-destructive/90",
            )}
            aria-label={isHidden ? "보이기" : "숨기기/삭제"}
            title={isSystem ? (isHidden ? "다시 표시" : "숨기기") : "삭제"}
          >
            <Trash2
              className="shrink-0"
              size={20}
              strokeWidth={2.25}
              color={isHidden ? "currentColor" : "#ffffff"}
              aria-hidden
            />
          </button>
        </div>
      </div>
    </div>
  );
}

function AddItemForm({
  placeholder,
  defaultColor,
  onAdd,
}: {
  placeholder: string;
  defaultColor: string;
  onAdd: (name: string, color: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [color, setColor] = useState(defaultColor);
  const [isAdding, setIsAdding] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteRef = useRef<HTMLDivElement | null>(null);

  const handleAdd = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setIsAdding(true);
    try {
      await onAdd(trimmed, normalizeHexColor(color, defaultColor));
      setValue("");
      setColor(defaultColor);
      setPaletteOpen(false);
    } finally {
      setIsAdding(false);
    }
  };

  useEffect(() => {
    if (!paletteOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!paletteRef.current?.contains(event.target as Node)) {
        setPaletteOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [paletteOpen]);

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleAdd();
          }}
          placeholder={placeholder}
          className="h-9 flex-1 rounded-[4px] border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="relative" ref={paletteRef}>
          <button
            type="button"
            onClick={() => setPaletteOpen((prev) => !prev)}
            className="h-9 w-9 rounded-full border-2 border-white shadow ring-1 ring-black/12 transition-transform hover:scale-105 dark:border-slate-800 dark:ring-white/20"
            style={{ backgroundColor: normalizeHexColor(color, defaultColor) }}
            aria-label="추가 항목 색상 선택"
            title="색상 변경"
          />
          {paletteOpen ? (
            <div className="absolute right-0 top-10 z-20 w-52 rounded-xl border bg-popover p-2 shadow-lg">
              <div className="mb-1 text-[11px] font-medium text-muted-foreground">추천 색상</div>
              <div className="grid grid-cols-5 gap-1.5">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={cn(
                      "h-7 w-7 rounded-full ring-1 ring-black/10 transition-transform hover:scale-105 dark:ring-white/20",
                      normalizeHexColor(color, defaultColor) === preset &&
                        "ring-2 ring-offset-2 ring-offset-background",
                    )}
                    style={{ backgroundColor: preset }}
                    onClick={() => {
                      setColor(preset);
                      setPaletteOpen(false);
                    }}
                    aria-label={`추천 색상 ${preset}`}
                    title={preset}
                  />
                ))}
              </div>
              <div className="mt-2 border-t pt-2">
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">직접 선택</p>
                  <HexColorPicker
                    color={normalizeHexColor(color, defaultColor)}
                    onChange={(next) => setColor(next)}
                    style={{ width: "100%", height: 120 }}
                  />
                  <HexColorInput
                    color={normalizeHexColor(color, defaultColor)}
                    onChange={(next) => setColor(normalizeHexColor(next, defaultColor))}
                    prefixed
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs uppercase"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          disabled={isAdding || !value.trim()}
          onClick={() => void handleAdd()}
          className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          추가
        </button>
      </div>
    </div>
  );
}

function SettingsNavRow({
  label,
  description,
  onClick,
  disabled,
  badge,
}: {
  label: string;
  description?: string;
  onClick?: () => void;
  disabled?: boolean;
  badge?: string;
}) {
  const content = (
    <>
      <div className="min-w-0 flex-1 text-left">
        <div className="font-medium">{label}</div>
        {description ? <div className="text-muted-foreground mt-0.5 text-xs">{description}</div> : null}
      </div>
      {badge ? (
        <span className="text-muted-foreground shrink-0 text-xs">{badge}</span>
      ) : !disabled ? (
        <ChevronRight className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden />
      ) : null}
    </>
  );

  if (disabled) {
    return (
      <div
        className="flex min-h-12 w-full items-center gap-3 rounded-2xl border bg-muted/30 px-4 py-3 opacity-60"
        aria-disabled
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 w-full touch-manipulation items-center gap-3 rounded-lg border border-hairline bg-card px-4 py-3 text-left shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] transition-colors hover:bg-accent/50 active:bg-accent"
    >
      {content}
    </button>
  );
}

export function SettingsPanel({
  userId,
  initialView = "home",
  initialDisplayName,
  initialEmail,
  initialPlatforms,
  initialPaymentMethods,
  initialBuyerAccounts,
  hiddenSettings,
  initialPurchaseTemplates,
  templateUsageCounts,
  initialPreferences,
  initialAiReviewProfile,
}: {
  userId: string;
  initialView?: SettingsPanelView;
  initialDisplayName: string;
  initialEmail: string;
  initialPlatforms: Platform[];
  initialPaymentMethods: PaymentMethod[];
  initialBuyerAccounts: BuyerAccount[];
  hiddenSettings: UserItemSetting[];
  initialPurchaseTemplates: PurchaseTemplateRow[];
  templateUsageCounts: Record<string, number>;
  initialPreferences: UserPreferences;
  initialAiReviewProfile: Database["public"]["Tables"]["user_ai_review_profiles"]["Row"] | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [view, setView] = useState<SettingsPanelView>(initialView);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [accountEmail] = useState(initialEmail);

  const [nicknameDraft, setNicknameDraft] = useState(initialDisplayName);
  const [isSavingName, setIsSavingName] = useState(false);

  const [platforms, setPlatforms] = useState<Platform[]>(initialPlatforms);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(initialPaymentMethods);
  const [buyerAccounts, setBuyerAccounts] = useState<BuyerAccount[]>(initialBuyerAccounts);
  const [purchaseTemplates, setPurchaseTemplates] = useState<PurchaseTemplateRow[]>(initialPurchaseTemplates);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [usageCounts, setUsageCounts] = useState(templateUsageCounts);
  const [hidden, setHidden] = useState<UserItemSetting[]>(hiddenSettings);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingColorId, setSavingColorId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [aiGender, setAiGender] = useState(initialAiReviewProfile?.gender ?? "");
  const [aiAgeRange, setAiAgeRange] = useState(initialAiReviewProfile?.age_range ?? "");
  const [aiRegion, setAiRegion] = useState(initialAiReviewProfile?.region ?? "");
  const [aiOccupation, setAiOccupation] = useState(initialAiReviewProfile?.occupation ?? "");
  const [aiExtraContext, setAiExtraContext] = useState(initialAiReviewProfile?.extra_context ?? "");
  const [isSavingAiProfile, setIsSavingAiProfile] = useState(false);

  const trimmedDraft = nicknameDraft.trim();
  const trimmedDisplay = displayName.trim();
  const nicknameDirty = trimmedDraft !== trimmedDisplay;
  const nicknameSaveDisabled = !nicknameDirty || trimmedDraft === "" || isSavingName;

  const goBack = useCallback(() => {
    setErrorMessage("");
    if (view === "account") setView("home");
    else if (view === "nickname") {
      setNicknameDraft(displayName);
      setView("account");
    } else if (view !== "home") setView("home");
  }, [view, displayName]);

  const openNicknameEdit = () => {
    setNicknameDraft(displayName);
    setView("nickname");
  };

  const handleSaveNickname = async () => {
    if (nicknameSaveDisabled) return;
    setErrorMessage("");
    setIsSavingName(true);
    try {
      const { error } = await supabase.from("users").update({ name: trimmedDraft }).eq("user_id", userId);
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      setDisplayName(trimmedDraft);
      setSuccessMessage("닉네임을 저장했습니다.");
      window.setTimeout(() => setSuccessMessage(""), 3500);
      setView("account");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  };

  const isHidden = (targetId: string, itemType: string) =>
    hidden.some((s) => s.target_id === targetId && s.item_type === itemType && s.is_hidden);

  const handleDeletePlatform = async (platform: Platform) => {
    setDeletingId(platform.id);
    setErrorMessage("");
    try {
      if (platform.user_id === null) {
        const alreadyHidden = isHidden(platform.id, "platform");
        if (alreadyHidden) {
          const { error } = await supabase
            .from("user_item_settings")
            .delete()
            .eq("user_id", userId)
            .eq("target_id", platform.id)
            .eq("item_type", "platform");
          if (error) {
            setErrorMessage(error.message);
            return;
          }
          setHidden((prev) => prev.filter((s) => !(s.target_id === platform.id && s.item_type === "platform")));
        } else {
          const { error } = await supabase
            .from("user_item_settings")
            .upsert({ user_id: userId, target_id: platform.id, item_type: "platform", is_hidden: true });
          if (error) {
            setErrorMessage(error.message);
            return;
          }
          setHidden((prev) => [...prev, { user_id: userId, target_id: platform.id, item_type: "platform", is_hidden: true }]);
        }
      } else {
        const confirmed = window.confirm(`"${platform.name}" 플랫폼을 삭제할까요?`);
        if (!confirmed) return;
        const { error } = await supabase.from("platforms").delete().eq("id", platform.id);
        if (error) {
          setErrorMessage(error.message);
          return;
        }
        setPlatforms((prev) => prev.filter((p) => p.id !== platform.id));
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeletePaymentMethod = async (method: PaymentMethod) => {
    setDeletingId(method.id);
    setErrorMessage("");
    try {
      if (method.user_id === null) {
        const alreadyHidden = isHidden(method.id, "payment_method");
        if (alreadyHidden) {
          const { error } = await supabase
            .from("user_item_settings")
            .delete()
            .eq("user_id", userId)
            .eq("target_id", method.id)
            .eq("item_type", "payment_method");
          if (error) {
            setErrorMessage(error.message);
            return;
          }
          setHidden((prev) => prev.filter((s) => !(s.target_id === method.id && s.item_type === "payment_method")));
        } else {
          const { error } = await supabase
            .from("user_item_settings")
            .upsert({ user_id: userId, target_id: method.id, item_type: "payment_method", is_hidden: true });
          if (error) {
            setErrorMessage(error.message);
            return;
          }
          setHidden((prev) => [
            ...prev,
            { user_id: userId, target_id: method.id, item_type: "payment_method", is_hidden: true },
          ]);
        }
      } else {
        const confirmed = window.confirm(`"${method.name}" 결제 수단을 삭제할까요?`);
        if (!confirmed) return;
        const { error } = await supabase.from("payment_methods").delete().eq("id", method.id);
        if (error) {
          setErrorMessage(error.message);
          return;
        }
        setPaymentMethods((prev) => prev.filter((m) => m.id !== method.id));
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteBuyerAccount = async (account: BuyerAccount) => {
    const confirmed = window.confirm(`"${account.label}" 계정을 삭제할까요?`);
    if (!confirmed) return;
    setDeletingId(account.id);
    setErrorMessage("");
    try {
      const { error } = await supabase.from("buyer_accounts").delete().eq("id", account.id);
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      setBuyerAccounts((prev) => prev.filter((a) => a.id !== account.id));
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddPlatform = async (name: string, color: string) => {
    const { data, error } = await supabase
      .from("platforms")
      .insert({ name, user_id: userId, color: normalizeHexColor(color, DEFAULT_PLATFORM_COLOR) })
      .select("id, name, user_id, color")
      .single();
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setPlatforms((prev) => [...prev, data]);
  };

  const handleAddPaymentMethod = async (name: string, color: string) => {
    const { data, error } = await supabase
      .from("payment_methods")
      .insert({ name, user_id: userId, color: normalizeHexColor(color, DEFAULT_PAYMENT_METHOD_COLOR) })
      .select("id, name, user_id, color")
      .single();
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setPaymentMethods((prev) => [...prev, data]);
  };

  const handleAddBuyerAccount = async (label: string, color: string) => {
    const { data, error } = await supabase
      .from("buyer_accounts")
      .insert({ label, user_id: userId, color: normalizeHexColor(color, DEFAULT_BUYER_ACCOUNT_COLOR) })
      .select("id, label, color")
      .single();
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setBuyerAccounts((prev) => [...prev, data]);
  };

  const platformsWithMeta: ItemWithMeta<Platform>[] = platforms.map((p) => ({
    ...p,
    isSystem: p.user_id === null,
    isHidden: isHidden(p.id, "platform"),
  })).sort((a, b) => {
    if (a.isSystem !== b.isSystem) return a.isSystem ? 1 : -1;
    return a.name.localeCompare(b.name, "ko");
  });

  const methodsWithMeta: ItemWithMeta<PaymentMethod>[] = paymentMethods.map((m) => ({
    ...m,
    isSystem: m.user_id === null,
    isHidden: isHidden(m.id, "payment_method"),
  })).sort((a, b) => {
    if (a.isSystem !== b.isSystem) return a.isSystem ? 1 : -1;
    return a.name.localeCompare(b.name, "ko");
  });

  const handlePlatformColorChange = async (platform: Platform, nextColor: string) => {
    if (platform.user_id === null) return;
    const color = normalizeHexColor(nextColor, DEFAULT_PLATFORM_COLOR);
    if (normalizeHexColor(platform.color, DEFAULT_PLATFORM_COLOR) === color) return;
    setSavingColorId(platform.id);
    setErrorMessage("");
    try {
      const { error } = await supabase.from("platforms").update({ color }).eq("id", platform.id);
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      setPlatforms((prev) => prev.map((item) => (item.id === platform.id ? { ...item, color } : item)));
    } finally {
      setSavingColorId(null);
    }
  };

  const handlePaymentMethodColorChange = async (method: PaymentMethod, nextColor: string) => {
    if (method.user_id === null) return;
    const color = normalizeHexColor(nextColor, DEFAULT_PAYMENT_METHOD_COLOR);
    if (normalizeHexColor(method.color, DEFAULT_PAYMENT_METHOD_COLOR) === color) return;
    setSavingColorId(method.id);
    setErrorMessage("");
    try {
      const { error } = await supabase.from("payment_methods").update({ color }).eq("id", method.id);
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      setPaymentMethods((prev) => prev.map((item) => (item.id === method.id ? { ...item, color } : item)));
    } finally {
      setSavingColorId(null);
    }
  };

  const handleBuyerAccountColorChange = async (account: BuyerAccount, nextColor: string) => {
    const color = normalizeHexColor(nextColor, DEFAULT_BUYER_ACCOUNT_COLOR);
    if (normalizeHexColor(account.color, DEFAULT_BUYER_ACCOUNT_COLOR) === color) return;
    setSavingColorId(account.id);
    setErrorMessage("");
    try {
      const { error } = await supabase.from("buyer_accounts").update({ color }).eq("id", account.id);
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      setBuyerAccounts((prev) => prev.map((item) => (item.id === account.id ? { ...item, color } : item)));
    } finally {
      setSavingColorId(null);
    }
  };

  const handleSaveAiReviewProfile = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    setIsSavingAiProfile(true);
    try {
      const { error } = await supabase.from("user_ai_review_profiles").upsert(
        {
          user_id: userId,
          gender: aiGender.trim() || null,
          age_range: aiAgeRange.trim() || null,
          region: aiRegion.trim() || null,
          occupation: aiOccupation.trim() || null,
          extra_context: aiExtraContext.trim() || null,
        },
        { onConflict: "user_id" },
      );
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      setSuccessMessage("AI 리뷰 기본 정보를 저장했습니다.");
      window.setTimeout(() => setSuccessMessage(""), 3500);
    } finally {
      setIsSavingAiProfile(false);
    }
  };

  const handleCopyPurchaseTemplate = async (t: PurchaseTemplateRow) => {
    setErrorMessage("");
    setSuccessMessage("");
    const line = buildKakaoPasteLine(t, "", "");
    try {
      await copyTextToClipboard(line);
      setSuccessMessage("클립보드에 복사했습니다. (주문번호·금액 칸은 비워 두었습니다.)");
      window.setTimeout(() => setSuccessMessage(""), 3500);
    } catch {
      setErrorMessage("복사에 실패했습니다. 브라우저의 클립보드 권한을 확인한 뒤 다시 시도해 주세요.");
    }
  };

  const updatePreferences = async (
    patch: Database["public"]["Tables"]["user_preferences"]["Update"],
    successMessageText?: string,
  ) => {
    setErrorMessage("");
    const { error } = await supabase.from("user_preferences").upsert(
      { user_id: userId, ...patch },
      { onConflict: "user_id" },
    );
    if (error) {
      setErrorMessage(error.message);
      return false;
    }
    setPreferences((current) => ({ ...current, ...patch }));
    if (successMessageText) {
      setSuccessMessage(successMessageText);
      window.setTimeout(() => setSuccessMessage(""), 3500);
    }
    return true;
  };

  const clonePurchaseTemplate = async (template: PurchaseTemplateRow) => {
    setErrorMessage("");
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
      setErrorMessage(error.message);
      return;
    }
    setPurchaseTemplates((current) => [data, ...current]);
    setUsageCounts((current) => ({ ...current, [data.id]: 0 }));
    setSuccessMessage("템플릿 복사본을 만들었습니다.");
    window.setTimeout(() => setSuccessMessage(""), 3500);
  };

  const setDefaultPurchaseTemplate = async (templateId: string | null) => {
    await updatePreferences(
      { default_purchase_info_template_id: templateId },
      templateId ? "기본 구매 정보 템플릿을 변경했습니다." : "기본 템플릿 지정을 해제했습니다.",
    );
  };

  const deletePurchaseTemplate = async (template: PurchaseTemplateRow) => {
    const count = usageCounts[template.id] ?? 0;
    const confirmed = window.confirm(
      count > 0
        ? `"${template.title}" 템플릿은 주문 ${count}건에서 사용 중입니다. 삭제하면 주문과의 템플릿 연결이 해제됩니다. 삭제할까요?`
        : `"${template.title}" 템플릿을 삭제할까요?`,
    );
    if (!confirmed) return;

    const { error } = await supabase.from("purchase_info_templates").delete().eq("id", template.id);
    if (error) {
      setErrorMessage(error.message);
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
  };

  const subHeader =
    view !== "home" ? (
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex size-10 touch-manipulation items-center justify-center rounded-md border border-hairline bg-card shadow-sm transition-colors hover:bg-accent hover:text-primary"
          aria-label="뒤로"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        <h2 className="text-lg font-semibold tracking-tight">{VIEW_TITLES[view]}</h2>
      </div>
    ) : null;

  const alerts = (
    <>
      {errorMessage ? (
        <p className="text-destructive rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-50">
          {successMessage}
        </p>
      ) : null}
    </>
  );

  if (view === "nickname") {
    return (
      <div className="flex flex-col gap-4">
        {subHeader}
        {alerts}
        <section className="rounded-lg border border-hairline bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">닉네임</span>
            <input
              value={nicknameDraft}
              onChange={(e) => setNicknameDraft(e.target.value)}
              placeholder="표시 이름"
              autoComplete="nickname"
              className="h-11 rounded-[4px] border border-input bg-card px-3 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <button
            type="button"
            disabled={nicknameSaveDisabled}
            onClick={() => void handleSaveNickname()}
            className={cn(
              "mt-4 inline-flex h-11 w-full touch-manipulation items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors",
              nicknameSaveDisabled
                ? "cursor-not-allowed bg-muted text-muted-foreground"
                : "bg-primary text-primary-foreground hover:bg-primary-active",
            )}
          >
            {isSavingName ? "저장 중…" : "저장"}
          </button>
        </section>
      </div>
    );
  }

  if (view === "account") {
    return (
      <div className="flex flex-col gap-4">
        {subHeader}
        {alerts}
        <section className="flex flex-col gap-1 rounded-lg border border-hairline bg-card p-2 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]">
          <button
            type="button"
            onClick={openNicknameEdit}
            className="flex min-h-12 w-full touch-manipulation items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/60 active:bg-muted/80"
          >
            <span className="text-muted-foreground shrink-0 text-sm">닉네임</span>
            <span className="min-w-0 flex-1 truncate text-right text-sm font-medium">{displayName || "—"}</span>
            <ChevronRight className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden />
          </button>
          <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl px-3 py-2.5">
            <span className="text-muted-foreground shrink-0 text-sm">계정</span>
            <span className="min-w-0 flex-1 truncate text-right text-sm">{accountEmail || "—"}</span>
          </div>
        </section>
      </div>
    );
  }

  if (view === "defaults") {
    return (
      <div className="flex flex-col gap-4">
        {subHeader}
        {alerts}
        <section className="rounded-lg border border-hairline bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] sm:p-5">
          <SectionHeader
            title="새 주문 기본값"
            description="선택한 값은 새 주문을 열 때 먼저 적용됩니다. 지정하지 않은 항목은 마지막 저장 주문의 값을 사용합니다."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">결제 플랫폼</span>
              <select value={preferences.default_platform_id ?? ""} onChange={(event) => void updatePreferences({ default_platform_id: event.target.value || null })} className="h-10 rounded-xl border border-input bg-background px-3">
                <option value="">최근 사용값</option>
                {platforms.filter((item) => !isHidden(item.id, "platform")).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">결제 수단</span>
              <select value={preferences.default_payment_method_id ?? ""} onChange={(event) => void updatePreferences({ default_payment_method_id: event.target.value || null })} className="h-10 rounded-xl border border-input bg-background px-3">
                <option value="">최근 사용값</option>
                {paymentMethods.filter((item) => !isHidden(item.id, "payment_method")).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">구매 계정</span>
              <select value={preferences.default_buyer_account_id ?? ""} onChange={(event) => void updatePreferences({ default_buyer_account_id: event.target.value || null })} className="h-10 rounded-xl border border-input bg-background px-3">
                <option value="">최근 사용값</option>
                {buyerAccounts.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">구매 정보 템플릿</span>
              <select value={preferences.default_purchase_info_template_id ?? ""} onChange={(event) => void updatePreferences({ default_purchase_info_template_id: event.target.value || null })} className="h-10 rounded-xl border border-input bg-background px-3">
                <option value="">최근 사용값</option>
                {purchaseTemplates.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-hairline bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] sm:p-5">
          <SectionHeader title="업무 흐름" description="저장 뒤 이동 방식과 목록 표시 밀도를 정합니다." />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">주문 저장 후</span>
              <select value={preferences.order_save_action} onChange={(event) => void updatePreferences({ order_save_action: event.target.value as OrderSaveAction })} className="h-10 rounded-xl border border-input bg-background px-3">
                <option value="ledger">구매장부로 이동</option>
                <option value="same">같은 정보로 계속 등록</option>
                <option value="blank">빈 입력 화면 열기</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">구매장부 밀도</span>
              <select value={preferences.ledger_density} onChange={(event) => void updatePreferences({ ledger_density: event.target.value })} className="h-10 rounded-xl border border-input bg-background px-3">
                <option value="compact">촘촘하게</option>
                <option value="comfortable">편안하게</option>
              </select>
            </label>
          </div>
          <label className="mt-4 flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm">
            <span>
              <span className="block font-medium">자동추천 연속 처리</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">저장·삭제 후 다음 대기 추천으로 이동합니다.</span>
            </span>
            <input type="checkbox" checked={preferences.auto_advance_recommendations} onChange={(event) => void updatePreferences({ auto_advance_recommendations: event.target.checked })} className="h-5 w-5 accent-primary" />
          </label>
        </section>
      </div>
    );
  }

  if (view === "purchase-templates") {
    return (
      <div className="flex flex-col gap-4">
        {subHeader}
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
              purchaseTemplates.map((t) => (
                <div
                  key={t.id}
                  className="flex min-h-11 flex-col gap-2 rounded-xl border px-3 py-2.5 sm:flex-row sm:items-center"
                >
                  <Link
                    href={`/settings/purchase-templates/detail?id=${encodeURIComponent(t.id)}`}
                    className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium transition-colors hover:bg-muted/50 active:bg-muted/70"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate">{t.title}</span>
                        {preferences.default_purchase_info_template_id === t.id ? <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" aria-label="기본 템플릿" /> : null}
                      </span>
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        입력 {countFilledTemplateFields(t)}개 · 주문 {usageCounts[t.id] ?? 0}건 · {templateUpdatedFormatter.format(new Date(t.updated_at))} 수정
                      </span>
                    </span>
                    <ChevronRight className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden />
                  </Link>
                  <div className="grid grid-cols-4 gap-1.5 sm:flex sm:shrink-0">
                    <button type="button" onClick={() => void setDefaultPurchaseTemplate(preferences.default_purchase_info_template_id === t.id ? null : t.id)} className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-medium hover:bg-muted" title="새 주문 기본 템플릿">
                      <Star className="h-3.5 w-3.5" aria-hidden /> 기본
                    </button>
                    <button type="button" onClick={() => void clonePurchaseTemplate(t)} className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-medium hover:bg-muted" title="템플릿 복제">
                      <Copy className="h-3.5 w-3.5" aria-hidden /> 복제
                    </button>
                    <button type="button" onClick={() => void handleCopyPurchaseTemplate(t)} className="min-h-9 rounded-lg border px-2 text-xs font-medium hover:bg-muted" title="카톡 한 줄 복사">내용 복사</button>
                    <button type="button" onClick={() => void deletePurchaseTemplate(t)} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-destructive/30 px-2 text-xs font-medium text-destructive hover:bg-destructive/10" title="템플릿 삭제">
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

  if (view === "ai") {
    return (
      <div className="flex flex-col gap-4">
        {subHeader}
        {alerts}
        <section className="rounded-lg border border-hairline bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]">
          <SectionHeader
            title="AI 리뷰 기본 정보"
            description="이름·전화번호 등 민감한 개인정보는 넣지 마세요. 성별·나이대·거주 지역 정도만 저장해 리뷰 톤을 맞출 때 사용합니다."
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">성별</span>
              <input
                value={aiGender}
                onChange={(e) => setAiGender(e.target.value)}
                placeholder="예: 여성"
                className="h-10 rounded-[4px] border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">나이대</span>
              <input
                value={aiAgeRange}
                onChange={(e) => setAiAgeRange(e.target.value)}
                placeholder="예: 30대"
                className="h-10 rounded-[4px] border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium">거주 지역</span>
              <input
                value={aiRegion}
                onChange={(e) => setAiRegion(e.target.value)}
                placeholder="예: 경기 성남 (구체적 주소는 비추천)"
                className="h-10 rounded-[4px] border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium">직업·생활 맥락</span>
              <input
                value={aiOccupation}
                onChange={(e) => setAiOccupation(e.target.value)}
                placeholder="예: 사무직, 육아 중 등"
                className="h-10 rounded-[4px] border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium">추가 설명</span>
              <textarea
                value={aiExtraContext}
                onChange={(e) => setAiExtraContext(e.target.value)}
                rows={3}
                placeholder="리뷰 말투·취향 등 부담 없이 적을 수 있는 범위에서만 적어 주세요."
                className="min-h-[5rem] resize-y rounded-[4px] border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={isSavingAiProfile}
            onClick={() => void handleSaveAiReviewProfile()}
            className="mt-4 inline-flex h-10 w-full touch-manipulation items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50 sm:w-auto"
          >
            {isSavingAiProfile ? "저장 중…" : "AI 리뷰 기본 정보 저장"}
          </button>
        </section>
      </div>
    );
  }

  if (view === "platforms") {
    return (
      <div className="flex flex-col gap-4">
        {subHeader}
        {alerts}
        <section className="rounded-lg border border-hairline bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]">
          <SectionHeader
            title="결제 플랫폼"
            description="기본 항목은 숨기기/보이기 토글, 직접 추가한 항목은 삭제됩니다."
          />
          <div className="flex flex-col gap-2">
            {platformsWithMeta.length === 0 ? (
              <p className="text-muted-foreground text-sm">등록된 플랫폼이 없습니다.</p>
            ) : (
              platformsWithMeta.map((p) => (
                <ItemRow
                  key={p.id}
                  label={p.name}
                  color={p.color}
                  isSystem={p.isSystem}
                  isHidden={p.isHidden}
                  canEditColor={!p.isSystem}
                  isDeleting={deletingId === p.id}
                  isSavingColor={savingColorId === p.id}
                  onDelete={() => void handleDeletePlatform(p)}
                  onChangeColor={(next) => handlePlatformColorChange(p, next)}
                />
              ))
            )}
          </div>
          <div className="mt-3">
            <AddItemForm
              placeholder="새 플랫폼 이름"
              defaultColor={DEFAULT_PLATFORM_COLOR}
              onAdd={handleAddPlatform}
            />
          </div>
        </section>
      </div>
    );
  }

  if (view === "payment-methods") {
    return (
      <div className="flex flex-col gap-4">
        {subHeader}
        {alerts}
        <section className="rounded-lg border border-hairline bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]">
          <SectionHeader
            title="결제 수단"
            description="기본 항목은 숨기기/보이기 토글, 직접 추가한 항목은 삭제됩니다."
          />
          <div className="flex flex-col gap-2">
            {methodsWithMeta.length === 0 ? (
              <p className="text-muted-foreground text-sm">등록된 결제 수단이 없습니다.</p>
            ) : (
              methodsWithMeta.map((m) => (
                <ItemRow
                  key={m.id}
                  label={m.name}
                  color={m.color}
                  isSystem={m.isSystem}
                  isHidden={m.isHidden}
                  canEditColor={!m.isSystem}
                  isDeleting={deletingId === m.id}
                  isSavingColor={savingColorId === m.id}
                  onDelete={() => void handleDeletePaymentMethod(m)}
                  onChangeColor={(next) => handlePaymentMethodColorChange(m, next)}
                />
              ))
            )}
          </div>
          <div className="mt-3">
            <AddItemForm
              placeholder="새 결제 수단 이름"
              defaultColor={DEFAULT_PAYMENT_METHOD_COLOR}
              onAdd={handleAddPaymentMethod}
            />
          </div>
        </section>
      </div>
    );
  }

  if (view === "buyer-accounts") {
    return (
      <div className="flex flex-col gap-4">
        {subHeader}
        {alerts}
        <section className="rounded-lg border border-hairline bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]">
          <SectionHeader title="구매 계정" description="주문 시 선택할 구매자 계정 별칭을 관리합니다." />
          <div className="flex flex-col gap-2">
            {buyerAccounts.length === 0 ? (
              <p className="text-muted-foreground text-sm">등록된 계정이 없습니다.</p>
            ) : (
              buyerAccounts.map((a) => (
                <ItemRow
                  key={a.id}
                  label={a.label}
                  color={a.color}
                  isSystem={false}
                  isHidden={false}
                  canEditColor
                  isDeleting={deletingId === a.id}
                  isSavingColor={savingColorId === a.id}
                  onDelete={() => void handleDeleteBuyerAccount(a)}
                  onChangeColor={(next) => handleBuyerAccountColorChange(a, next)}
                />
              ))
            )}
          </div>
          <div className="mt-3">
            <AddItemForm
              placeholder="새 계정 별칭 (예: 혜미)"
              defaultColor={DEFAULT_BUYER_ACCOUNT_COLOR}
              onAdd={handleAddBuyerAccount}
            />
          </div>
        </section>
      </div>
    );
  }

  /* home */
  return (
    <div className="flex flex-col gap-5">
      {alerts}

      <button
        type="button"
        onClick={() => setView("account")}
        className="flex w-full touch-manipulation flex-col items-stretch gap-1 rounded-lg border border-hairline bg-card p-4 text-left shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] transition-colors hover:bg-accent/50 active:bg-accent"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold tracking-tight">{(displayName || "회원").replace(/님$/, "")}님</div>
            <div className="text-muted-foreground mt-0.5 truncate text-sm">{accountEmail || "—"}</div>
          </div>
          <ChevronRight className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        </div>
      </button>

      {/* 설정 홈은 성격이 비슷한 항목을 카드 격자로 묶어 넓은 화면의 빈 공간을 줄입니다. */}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <SettingsNavRow label="주문 기본값" description="기본 항목·저장 후 동작" onClick={() => setView("defaults")} />
        <SettingsNavRow label="구매 정보 템플릿" description={`${purchaseTemplates.length}개 저장됨`} onClick={() => setView("purchase-templates")} />
        <SettingsNavRow label="AI 설정 관리" description="리뷰 생성 기본 정보" onClick={() => setView("ai")} />
        <SettingsNavRow label="결제플랫폼 관리" onClick={() => setView("platforms")} />
        <SettingsNavRow label="결제수단 관리" onClick={() => setView("payment-methods")} />
        <SettingsNavRow label="구매계정 관리" onClick={() => setView("buyer-accounts")} />
      </div>

      <SettingsNavRow label="공지사항" disabled badge="준비 중" />

      <button
        type="button"
        onClick={() => void handleLogout()}
        className="min-h-12 w-full touch-manipulation rounded-full border border-red-200 bg-card py-3 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50 active:bg-red-100 dark:border-red-900/60 dark:bg-slate-800 dark:text-red-500 dark:hover:bg-red-950/40"
      >
        로그아웃하기
      </button>
    </div>
  );
}
