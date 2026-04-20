"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ArrowLeft, ChevronRight, Plus, Trash2 } from "lucide-react";

import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import { buildKakaoPasteLine, type PurchaseTemplateRow } from "@/lib/kakao-purchase-paste";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { BuyerAccount, PaymentMethod, Platform } from "@/lib/master-data";
import type { Database } from "@/types/database";

type UserItemSetting = Database["public"]["Tables"]["user_item_settings"]["Row"];

type SettingsPanelView =
  | "home"
  | "account"
  | "nickname"
  | "purchase-templates"
  | "ai"
  | "platforms"
  | "payment-methods"
  | "buyer-accounts";

type ItemWithMeta<T> = T & { isSystem: boolean; isHidden: boolean };

const VIEW_TITLES: Record<Exclude<SettingsPanelView, "home">, string> = {
  account: "계정",
  nickname: "닉네임 변경",
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
      <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
    </div>
  );
}

function ItemRow({
  label,
  isSystem,
  isHidden,
  isDeleting,
  onDelete,
}: {
  label: string;
  isSystem: boolean;
  isHidden: boolean;
  isDeleting: boolean;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-xl border px-3 py-2.5",
        isHidden && "opacity-50",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm">{label}</span>
        {isSystem && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-700 dark:text-slate-400">
            기본
          </span>
        )}
      </div>
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
  );
}

function AddItemForm({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (name: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setIsAdding(true);
    try {
      await onAdd(trimmed);
      setValue("");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void handleAdd();
        }}
        placeholder={placeholder}
        className="h-9 flex-1 rounded-xl border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
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
      className="flex min-h-12 w-full touch-manipulation items-center gap-3 rounded-2xl border bg-white px-4 py-3 text-left shadow-sm transition-colors hover:bg-muted/40 active:bg-muted/60 dark:bg-slate-800 dark:hover:bg-slate-700/80"
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
  initialAiReviewProfile,
}: {
  userId: string;
  initialView?: "home" | "account";
  initialDisplayName: string;
  initialEmail: string;
  initialPlatforms: Platform[];
  initialPaymentMethods: PaymentMethod[];
  initialBuyerAccounts: BuyerAccount[];
  hiddenSettings: UserItemSetting[];
  initialPurchaseTemplates: PurchaseTemplateRow[];
  initialAiReviewProfile: Database["public"]["Tables"]["user_ai_review_profiles"]["Row"] | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [view, setView] = useState<SettingsPanelView>(initialView === "account" ? "account" : "home");
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [accountEmail] = useState(initialEmail);

  const [nicknameDraft, setNicknameDraft] = useState(initialDisplayName);
  const [isSavingName, setIsSavingName] = useState(false);

  const [platforms, setPlatforms] = useState<Platform[]>(initialPlatforms);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(initialPaymentMethods);
  const [buyerAccounts, setBuyerAccounts] = useState<BuyerAccount[]>(initialBuyerAccounts);
  const [purchaseTemplates] = useState<PurchaseTemplateRow[]>(initialPurchaseTemplates);
  const [hidden, setHidden] = useState<UserItemSetting[]>(hiddenSettings);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

  const handleAddPlatform = async (name: string) => {
    const { data, error } = await supabase
      .from("platforms")
      .insert({ name, user_id: userId })
      .select("id, name, user_id")
      .single();
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setPlatforms((prev) => [...prev, data]);
  };

  const handleAddPaymentMethod = async (name: string) => {
    const { data, error } = await supabase
      .from("payment_methods")
      .insert({ name, user_id: userId })
      .select("id, name, user_id")
      .single();
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setPaymentMethods((prev) => [...prev, data]);
  };

  const handleAddBuyerAccount = async (label: string) => {
    const { data, error } = await supabase
      .from("buyer_accounts")
      .insert({ label, user_id: userId })
      .select("id, label")
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
  }));

  const methodsWithMeta: ItemWithMeta<PaymentMethod>[] = paymentMethods.map((m) => ({
    ...m,
    isSystem: m.user_id === null,
    isHidden: isHidden(m.id, "payment_method"),
  }));

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
      setErrorMessage("복사에 실패했습니다. 앱을 다시 빌드(cap sync)한 뒤 다시 시도해 주세요.");
    }
  };

  const subHeader =
    view !== "home" ? (
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex size-10 touch-manipulation items-center justify-center rounded-xl border bg-background shadow-sm transition-colors hover:bg-muted"
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
        <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">닉네임</span>
            <input
              value={nicknameDraft}
              onChange={(e) => setNicknameDraft(e.target.value)}
              placeholder="표시 이름"
              autoComplete="nickname"
              className="h-11 rounded-xl border border-input bg-transparent px-3 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <button
            type="button"
            disabled={nicknameSaveDisabled}
            onClick={() => void handleSaveNickname()}
            className={cn(
              "mt-4 inline-flex h-11 w-full touch-manipulation items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors",
              nicknameSaveDisabled
                ? "cursor-not-allowed bg-muted text-muted-foreground"
                : "bg-orange-600 text-white hover:bg-orange-600/90 active:bg-orange-700",
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
        <section className="flex flex-col gap-1 rounded-2xl bg-white p-2 shadow-sm dark:bg-slate-800">
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

  if (view === "purchase-templates") {
    return (
      <div className="flex flex-col gap-4">
        {subHeader}
        {alerts}
        <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
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
                  className="flex min-h-11 items-stretch gap-1 rounded-xl border px-2 py-1.5 sm:gap-2 sm:px-3 sm:py-2"
                >
                  <Link
                    href={`/settings/purchase-templates/detail?id=${encodeURIComponent(t.id)}`}
                    className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium transition-colors hover:bg-muted/50 active:bg-muted/70"
                  >
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    <ChevronRight className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden />
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleCopyPurchaseTemplate(t)}
                    className="touch-manipulation shrink-0 self-center rounded-lg border border-input bg-background px-2.5 py-2 text-xs font-medium shadow-sm transition-colors hover:bg-muted/60 active:bg-muted sm:px-3 sm:text-sm"
                  >
                    복사하기
                  </button>
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
        <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
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
                className="h-10 rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">나이대</span>
              <input
                value={aiAgeRange}
                onChange={(e) => setAiAgeRange(e.target.value)}
                placeholder="예: 30대"
                className="h-10 rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium">거주 지역</span>
              <input
                value={aiRegion}
                onChange={(e) => setAiRegion(e.target.value)}
                placeholder="예: 경기 성남 (구체적 주소는 비추천)"
                className="h-10 rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium">직업·생활 맥락</span>
              <input
                value={aiOccupation}
                onChange={(e) => setAiOccupation(e.target.value)}
                placeholder="예: 사무직, 육아 중 등"
                className="h-10 rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium">추가 설명</span>
              <textarea
                value={aiExtraContext}
                onChange={(e) => setAiExtraContext(e.target.value)}
                rows={3}
                placeholder="리뷰 말투·취향 등 부담 없이 적을 수 있는 범위에서만 적어 주세요."
                className="min-h-[5rem] resize-y rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
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
        <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
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
                  isSystem={p.isSystem}
                  isHidden={p.isHidden}
                  isDeleting={deletingId === p.id}
                  onDelete={() => void handleDeletePlatform(p)}
                />
              ))
            )}
          </div>
          <div className="mt-3">
            <AddItemForm placeholder="새 플랫폼 이름" onAdd={handleAddPlatform} />
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
        <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
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
                  isSystem={m.isSystem}
                  isHidden={m.isHidden}
                  isDeleting={deletingId === m.id}
                  onDelete={() => void handleDeletePaymentMethod(m)}
                />
              ))
            )}
          </div>
          <div className="mt-3">
            <AddItemForm placeholder="새 결제 수단 이름" onAdd={handleAddPaymentMethod} />
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
        <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
          <SectionHeader title="구매 계정" description="주문 시 선택할 구매자 계정 별칭을 관리합니다." />
          <div className="flex flex-col gap-2">
            {buyerAccounts.length === 0 ? (
              <p className="text-muted-foreground text-sm">등록된 계정이 없습니다.</p>
            ) : (
              buyerAccounts.map((a) => (
                <ItemRow
                  key={a.id}
                  label={a.label}
                  isSystem={false}
                  isHidden={false}
                  isDeleting={deletingId === a.id}
                  onDelete={() => void handleDeleteBuyerAccount(a)}
                />
              ))
            )}
          </div>
          <div className="mt-3">
            <AddItemForm placeholder="새 계정 별칭 (예: 혜미)" onAdd={handleAddBuyerAccount} />
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
        className="flex w-full touch-manipulation flex-col items-stretch gap-1 rounded-2xl border bg-white p-4 text-left shadow-sm transition-colors hover:bg-muted/30 active:bg-muted/50 dark:bg-slate-800 dark:hover:bg-slate-700/50"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold tracking-tight">{(displayName || "회원").replace(/님$/, "")}님</div>
            <div className="text-muted-foreground mt-0.5 truncate text-sm">{accountEmail || "—"}</div>
          </div>
          <ChevronRight className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        </div>
      </button>

      <SettingsNavRow label="공지사항" disabled badge="준비 중" />

      <SettingsNavRow label="구매 정보 템플릿" onClick={() => setView("purchase-templates")} />

      <div className="flex flex-col gap-2">
        <SettingsNavRow label="AI 설정 관리" onClick={() => setView("ai")} />
        <SettingsNavRow label="결제플랫폼 관리" onClick={() => setView("platforms")} />
        <SettingsNavRow label="결제수단 관리" onClick={() => setView("payment-methods")} />
        <SettingsNavRow label="구매계정 관리" onClick={() => setView("buyer-accounts")} />
      </div>

      <button
        type="button"
        onClick={() => void handleLogout()}
        className="min-h-12 w-full touch-manipulation rounded-2xl border border-red-200 bg-white py-3 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50 active:bg-red-100 dark:border-red-900/60 dark:bg-slate-800 dark:text-red-500 dark:hover:bg-red-950/40"
      >
        로그아웃하기
      </button>
    </div>
  );
}
