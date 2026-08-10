"use client";

import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  LayoutDashboard,
  Plus,
  Settings,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";

import { fetchMasterData } from "@/lib/master-data";
import { type PurchaseTemplateRow } from "@/lib/kakao-purchase-paste";
import { createClient } from "@/lib/supabase/client";
import {
  getOrCreateUserPreferences,
  type LedgerDensity,
  type OrderSaveAction,
  type UserPreferences,
} from "@/lib/user-preferences";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type AiReviewProfile = Database["public"]["Tables"]["user_ai_review_profiles"]["Row"];

type TourData = {
  userId: string;
  displayName: string;
  displayEmail: string;
  preferences: UserPreferences;
  master: Awaited<ReturnType<typeof fetchMasterData>>;
  templates: PurchaseTemplateRow[];
  aiReviewProfile: AiReviewProfile | null;
};

type TourPhase = "checking" | "ready" | "hidden";

const TOUR_STEPS = [
  {
    id: "welcome",
    kind: "welcome",
    title: "리뷰 매니저에 오신 것을 환영해요",
    description: "주문을 기록하고, 입금과 리뷰 작업까지 한 흐름으로 정리할 수 있어요.",
  },
  {
    id: "ledger",
    kind: "menu",
    target: "ledger",
    title: "구매 장부",
    description: "등록한 주문을 한곳에서 찾고, 배송·입금·완료 상태를 관리하는 기본 화면입니다.",
    hint: "오늘 처리할 주문과 완료된 주문을 나눠서 확인할 수 있어요.",
    icon: ClipboardList,
  },
  {
    id: "new-order",
    kind: "menu",
    target: "new-order",
    title: "주문 추가",
    description: "새 주문을 직접 입력하는 곳입니다. 아래에서 정한 기본값과 템플릿이 먼저 채워집니다.",
    hint: "같은 구매 정보를 여러 계정에 복제해 등록할 수도 있어요.",
    icon: Plus,
  },
  {
    id: "recommendations",
    kind: "menu",
    target: "recommendations",
    title: "자동 추천",
    description: "크롤링한 주문과 입금 내역을 확인하고, 알맞은 주문과 연결하는 화면입니다.",
    hint: "추천 결과를 검수한 뒤 주문으로 저장하거나 입금 완료 처리할 수 있어요.",
    icon: Sparkles,
  },
  {
    id: "dashboard",
    kind: "menu",
    target: "dashboard",
    title: "대시보드",
    description: "기간별 주문 수, 완료율, 금액 흐름을 요약해서 보는 화면입니다.",
    hint: "숫자 카드를 누르면 해당 조건의 구매 장부로 바로 이동할 수 있어요.",
    icon: LayoutDashboard,
  },
  {
    id: "settings",
    kind: "menu",
    target: "settings",
    title: "설정",
    description: "닉네임, 주문 기본값, 구매 정보 템플릿, AI 리뷰 정보를 관리하는 곳입니다.",
    hint: "지금부터 자주 쓰는 설정을 순서대로 저장해 볼게요.",
    icon: Settings,
  },
  {
    id: "nickname",
    kind: "nickname",
    title: "먼저 닉네임을 정해볼까요?",
    description: "메뉴에서 계정을 알아보기 쉽게 표시할 이름입니다.",
  },
  {
    id: "template",
    kind: "template",
    title: "구매 정보 템플릿을 준비해요",
    description: "자주 쓰는 배송·계정 정보를 저장해 두면 주문을 만들 때 매번 다시 입력하지 않아도 됩니다.",
  },
  {
    id: "defaults",
    kind: "defaults",
    title: "새 주문 기본값을 정해요",
    description: "새 주문 화면을 열 때 먼저 선택되어 있을 플랫폼·결제수단·구매계정과 저장 방식을 정합니다.",
  },
  {
    id: "ai",
    kind: "ai",
    title: "AI 리뷰 기본 정보를 설정해요",
    description: "성별·나이대·생활 맥락처럼 리뷰 톤을 맞추는 데 필요한 정보만 선택적으로 저장합니다.",
  },
  {
    id: "finish",
    kind: "finish",
    title: "준비가 끝났어요",
    description: "설정은 언제든 설정 메뉴에서 바꿀 수 있습니다. 이제 구매 장부부터 시작해 보세요.",
  },
] as const;

const TOUR_CONTROL_CLASS =
  "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const TOUR_TEXTAREA_CLASS =
  "min-h-20 w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** 튜토리얼 안에서도 기존 설정 화면과 같은 간격·입력 스타일을 유지합니다. */
function TourField({
  label,
  hint,
  required = false,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm">
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-medium">
          {label}
          {required ? <span className="ml-0.5 text-destructive">*</span> : null}
        </span>
        {hint ? <span className="text-[11px] font-normal text-muted-foreground">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

function displayNameForUser(user: User, publicName: string | null | undefined) {
  const metadataName =
    typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  const shortMetadataName = typeof user.user_metadata?.name === "string" ? user.user_metadata.name.trim() : "";
  const emailName = user.email?.split("@")[0]?.trim() ?? "";
  return publicName?.trim() || metadataName || shortMetadataName || emailName || "회원";
}

export function OnboardingTour() {
  const supabase = useMemo(() => createClient(), []);
  const [phase, setPhase] = useState<TourPhase>("checking");
  const [tourData, setTourData] = useState<TourData | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const activeUserIdRef = useRef<string | null>(null);
  const loadingUserIdRef = useRef<string | null>(null);
  const loadedUserIdRef = useRef<string | null>(null);

  const [nickname, setNickname] = useState("");
  const [templateChoice, setTemplateChoice] = useState("new");
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateBuyerName, setTemplateBuyerName] = useState("");
  const [templateRecipientName, setTemplateRecipientName] = useState("");
  const [templateLoginId, setTemplateLoginId] = useState("");
  const [templatePhone, setTemplatePhone] = useState("");
  const [templateAddress, setTemplateAddress] = useState("");
  const [templateBankAccountNumber, setTemplateBankAccountNumber] = useState("");
  const [templateAccountHolder, setTemplateAccountHolder] = useState("");
  const [useTemplateAsDefault, setUseTemplateAsDefault] = useState(true);
  const [defaultPlatformId, setDefaultPlatformId] = useState("");
  const [defaultPaymentMethodId, setDefaultPaymentMethodId] = useState("");
  const [defaultBuyerAccountId, setDefaultBuyerAccountId] = useState("");
  const [defaultPurchaseInfoTemplateId, setDefaultPurchaseInfoTemplateId] = useState("");
  const [orderSaveAction, setOrderSaveAction] = useState<OrderSaveAction>("ledger");
  const [ledgerDensity, setLedgerDensity] = useState<LedgerDensity>("compact");
  const [autoAdvanceRecommendations, setAutoAdvanceRecommendations] = useState(true);
  const [aiGender, setAiGender] = useState("");
  const [aiAgeRange, setAiAgeRange] = useState("");
  const [aiRegion, setAiRegion] = useState("");
  const [aiOccupation, setAiOccupation] = useState("");
  const [aiExtraContext, setAiExtraContext] = useState("");

  const loadForUser = useCallback(
    async (user: User) => {
      if (loadedUserIdRef.current === user.id || loadingUserIdRef.current === user.id) return;
      loadingUserIdRef.current = user.id;

      try {
        const { data: publicUser, error: publicUserError } = await supabase
          .from("users")
          .select("name, email, onboarding_completed_at")
          .eq("user_id", user.id)
          .maybeSingle();
        if (publicUserError) throw publicUserError;

        if (publicUser?.onboarding_completed_at) {
          loadedUserIdRef.current = user.id;
          setPhase("hidden");
          return;
        }

        const [master, preferences, templatesResult, aiProfileResult] = await Promise.all([
          fetchMasterData(supabase, user.id),
          getOrCreateUserPreferences(supabase, user.id),
          supabase
            .from("purchase_info_templates")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase.from("user_ai_review_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        ]);
        if (templatesResult.error) throw templatesResult.error;
        if (aiProfileResult.error) throw aiProfileResult.error;
        if (activeUserIdRef.current !== user.id) return;

        const nextData: TourData = {
          userId: user.id,
          displayName: displayNameForUser(user, publicUser?.name),
          displayEmail: publicUser?.email ?? user.email ?? user.id,
          preferences,
          master,
          templates: templatesResult.data ?? [],
          aiReviewProfile: aiProfileResult.data ?? null,
        };

        // 로드한 기존 값을 각 단계의 초깃값으로 넣어 사용자가 이어서 수정할 수 있게 합니다.
        setTourData(nextData);
        setNickname(nextData.displayName);
        setTemplateChoice(preferences.default_purchase_info_template_id ?? "new");
        setUseTemplateAsDefault(true);
        setDefaultPlatformId(preferences.default_platform_id ?? "");
        setDefaultPaymentMethodId(preferences.default_payment_method_id ?? "");
        setDefaultBuyerAccountId(preferences.default_buyer_account_id ?? "");
        setDefaultPurchaseInfoTemplateId(preferences.default_purchase_info_template_id ?? "");
        setOrderSaveAction((preferences.order_save_action as OrderSaveAction) || "ledger");
        setLedgerDensity((preferences.ledger_density as LedgerDensity) || "compact");
        setAutoAdvanceRecommendations(preferences.auto_advance_recommendations);
        setAiGender(nextData.aiReviewProfile?.gender ?? "");
        setAiAgeRange(nextData.aiReviewProfile?.age_range ?? "");
        setAiRegion(nextData.aiReviewProfile?.region ?? "");
        setAiOccupation(nextData.aiReviewProfile?.occupation ?? "");
        setAiExtraContext(nextData.aiReviewProfile?.extra_context ?? "");
        loadedUserIdRef.current = user.id;
        setPhase("ready");
      } catch (error) {
        // 온보딩은 업무 화면을 막지 않도록 조회 실패 시 조용히 숨깁니다.
        console.error("[onboarding] 초기 설정을 불러오지 못했습니다.", error);
        setPhase("hidden");
      } finally {
        loadingUserIdRef.current = null;
      }
    },
    [supabase],
  );

  useEffect(() => {
    const setActiveUser = (user: User | null) => {
      activeUserIdRef.current = user?.id ?? null;
      if (!user) {
        loadedUserIdRef.current = null;
        setTourData(null);
        setPhase("hidden");
        return;
      }
      void loadForUser(user);
    };

    void supabase.auth.getUser().then(({ data: { user } }) => setActiveUser(user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") setActiveUser(null);
      if (event === "SIGNED_IN" && session?.user) setActiveUser(session.user);
    });

    return () => subscription.unsubscribe();
  }, [loadForUser, supabase]);

  useEffect(() => {
    if (phase !== "ready") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [phase]);

  const currentStep = TOUR_STEPS[stepIndex];
  const currentTarget = currentStep.kind === "menu" ? currentStep.target : undefined;
  const CurrentStepIcon = currentStep.kind === "menu" ? currentStep.icon : null;

  useLayoutEffect(() => {
    if (phase !== "ready" || !currentTarget) {
      setTargetRect(null);
      return;
    }

    const measureTarget = () => {
      const elements = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-onboarding-target="${currentTarget}"]`),
      );
      const target = elements.find((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      });
      setTargetRect(target?.getBoundingClientRect() ?? null);
    };

    const frame = window.requestAnimationFrame(measureTarget);
    window.addEventListener("resize", measureTarget);
    window.addEventListener("scroll", measureTarget, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("scroll", measureTarget, true);
    };
  }, [currentTarget, phase]);

  const markComplete = useCallback(async () => {
    if (!tourData) return false;
    setErrorMessage("");
    setIsCompleting(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq("user_id", tourData.userId);
      if (error) {
        setErrorMessage(error.message);
        return false;
      }
      setTourData(null);
      setPhase("hidden");
      return true;
    } finally {
      setIsCompleting(false);
    }
  }, [supabase, tourData]);

  const saveNickname = async () => {
    if (!tourData) return false;
    const value = nickname.trim();
    if (!value) {
      setErrorMessage("닉네임을 한 글자 이상 입력해 주세요.");
      return false;
    }
    const { error } = await supabase.from("users").update({ name: value }).eq("user_id", tourData.userId);
    if (error) {
      setErrorMessage(error.message);
      return false;
    }
    setTourData((current) => (current ? { ...current, displayName: value } : current));
    return true;
  };

  const saveTemplate = async () => {
    if (!tourData) return false;

    if (templateChoice !== "new") {
      const { error } = await supabase.from("user_preferences").upsert(
        {
          user_id: tourData.userId,
          default_purchase_info_template_id: useTemplateAsDefault ? templateChoice : null,
        },
        { onConflict: "user_id" },
      );
      if (error) {
        setErrorMessage(error.message);
        return false;
      }
      setDefaultPurchaseInfoTemplateId(useTemplateAsDefault ? templateChoice : "");
      setTourData((current) =>
        current
          ? {
              ...current,
              preferences: {
                ...current.preferences,
                default_purchase_info_template_id: useTemplateAsDefault ? templateChoice : null,
              },
            }
          : current,
      );
      return true;
    }

    const title = templateTitle.trim();
    if (!title) {
      setErrorMessage("새 템플릿을 만들려면 제목을 입력해 주세요. 나중에 설정하려면 건너뛰기를 눌러 주세요.");
      return false;
    }

    const { data: template, error: templateError } = await supabase
      .from("purchase_info_templates")
      .insert({
        user_id: tourData.userId,
        title,
        buyer_name: templateBuyerName.trim() || null,
        recipient_name: templateRecipientName.trim() || null,
        login_id: templateLoginId.trim() || null,
        phone: templatePhone.trim() || null,
        address: templateAddress.trim() || null,
        bank_account_number: templateBankAccountNumber.trim() || null,
        account_holder: templateAccountHolder.trim() || null,
      })
      .select("*")
      .single();
    if (templateError || !template) {
      setErrorMessage(templateError?.message ?? "템플릿을 저장하지 못했습니다.");
      return false;
    }

    let nextPreferences = tourData.preferences;
    if (useTemplateAsDefault) {
      const { error: preferenceError } = await supabase.from("user_preferences").upsert(
        { user_id: tourData.userId, default_purchase_info_template_id: template.id },
        { onConflict: "user_id" },
      );
      if (preferenceError) {
        setErrorMessage(preferenceError.message);
        return false;
      }
      nextPreferences = { ...nextPreferences, default_purchase_info_template_id: template.id };
    }

    setTemplateChoice(template.id);
    setDefaultPurchaseInfoTemplateId(useTemplateAsDefault ? template.id : "");
    setTourData((current) =>
      current
        ? {
            ...current,
            templates: [template, ...current.templates],
            preferences: nextPreferences,
          }
        : current,
    );
    return true;
  };

  const saveDefaults = async () => {
    if (!tourData) return false;
    const patch: Database["public"]["Tables"]["user_preferences"]["Update"] = {
      default_platform_id: defaultPlatformId || null,
      default_payment_method_id: defaultPaymentMethodId || null,
      default_buyer_account_id: defaultBuyerAccountId || null,
      default_purchase_info_template_id: defaultPurchaseInfoTemplateId || null,
      order_save_action: orderSaveAction,
      ledger_density: ledgerDensity,
      auto_advance_recommendations: autoAdvanceRecommendations,
    };
    const { error } = await supabase
      .from("user_preferences")
      .upsert({ user_id: tourData.userId, ...patch }, { onConflict: "user_id" });
    if (error) {
      setErrorMessage(error.message);
      return false;
    }
    setTourData((current) => (current ? { ...current, preferences: { ...current.preferences, ...patch } } : current));
    return true;
  };

  const saveAiProfile = async () => {
    if (!tourData) return false;
    const { data: profile, error } = await supabase
      .from("user_ai_review_profiles")
      .upsert(
        {
          user_id: tourData.userId,
          gender: aiGender.trim() || null,
          age_range: aiAgeRange.trim() || null,
          region: aiRegion.trim() || null,
          occupation: aiOccupation.trim() || null,
          extra_context: aiExtraContext.trim() || null,
        },
        { onConflict: "user_id" },
      )
      .select("*")
      .single();
    if (error) {
      setErrorMessage(error.message);
      return false;
    }
    setTourData((current) => (current ? { ...current, aiReviewProfile: profile } : current));
    return true;
  };

  const advance = () => {
    setErrorMessage("");
    setStepIndex((current) => Math.min(current + 1, TOUR_STEPS.length - 1));
  };

  const handleNext = async () => {
    if (isSavingStep || isCompleting) return;
    if (currentStep.kind === "finish") {
      await markComplete();
      return;
    }
    if (currentStep.kind === "welcome" || currentStep.kind === "menu") {
      advance();
      return;
    }

    setErrorMessage("");
    setIsSavingStep(true);
    try {
      const saved =
        currentStep.kind === "nickname"
          ? await saveNickname()
          : currentStep.kind === "template"
            ? await saveTemplate()
            : currentStep.kind === "defaults"
              ? await saveDefaults()
              : await saveAiProfile();
      if (saved) advance();
    } finally {
      setIsSavingStep(false);
    }
  };

  const goBack = () => {
    setErrorMessage("");
    setStepIndex((current) => Math.max(0, current - 1));
  };

  const isSettingStep = ["nickname", "template", "defaults", "ai"].includes(currentStep.kind);
  const isLastStep = stepIndex === TOUR_STEPS.length - 1;

  if (phase !== "ready" || !tourData) return null;

  return (
    <>
      <div className={cn("fixed inset-0 z-[300]", !targetRect && "bg-black/45")} aria-hidden />
      {targetRect ? (
        <div
          className="pointer-events-none fixed z-[301] rounded-xl border-2 border-primary shadow-[0_0_0_9999px_rgb(0_0_0_/_0.45)]"
          style={{
            top: Math.max(4, targetRect.top - 6),
            left: Math.max(4, targetRect.left - 6),
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
          aria-hidden
        />
      ) : null}

      <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[302] sm:bottom-6 sm:left-1/2 sm:right-auto sm:w-[min(36rem,calc(100vw-2rem))] sm:-translate-x-1/2">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-tour-title"
          className="max-h-[min(78vh,44rem)] overflow-y-auto rounded-2xl border border-hairline bg-card text-card-foreground shadow-2xl ring-1 ring-black/10"
        >
          <div className="flex items-start justify-between gap-4 border-b border-hairline px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-primary">리뷰 매니저 시작 가이드</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {stepIndex + 1} / {TOUR_STEPS.length}
                </span>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${((stepIndex + 1) / TOUR_STEPS.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void markComplete()}
              disabled={isCompleting || isSavingStep}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              aria-label="튜토리얼 건너뛰기"
              title="튜토리얼 건너뛰기"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="px-4 py-5 sm:px-6">
            <h2 id="onboarding-tour-title" className="text-xl font-bold tracking-tight sm:text-2xl">
              {currentStep.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{currentStep.description}</p>

            <div className="mt-5">
              {currentStep.kind === "welcome" ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <ShoppingBag className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 text-sm leading-relaxed">
                      <p className="font-semibold">{tourData.displayName.replace(/님$/, "")}님, 필요한 것만 빠르게 안내할게요.</p>
                      <p className="mt-1 text-ink-muted">메뉴 설명을 먼저 보고, 바로 이어서 초기 설정을 저장합니다.</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {currentStep.kind === "menu" ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-xl bg-surface-soft p-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      {CurrentStepIcon ? <CurrentStepIcon className="h-5 w-5" aria-hidden /> : null}
                    </span>
                    <p className="text-sm font-medium">왼쪽 메뉴 또는 모바일 하단 메뉴에서 언제든 열 수 있어요.</p>
                  </div>
                  <p className="rounded-xl border border-hairline px-4 py-3 text-sm leading-relaxed text-ink-muted">
                    {currentStep.hint}
                  </p>
                </div>
              ) : null}

              {currentStep.kind === "nickname" ? (
                <div className="space-y-3">
                  <TourField label="닉네임" required hint="다른 사용자에게 공개되지 않아요">
                    <input
                      value={nickname}
                      onChange={(event) => setNickname(event.target.value)}
                      className={TOUR_CONTROL_CLASS}
                      autoComplete="nickname"
                      placeholder="표시할 이름"
                      autoFocus
                    />
                  </TourField>
                  <p className="text-xs leading-relaxed text-muted-foreground">현재 값이 마음에 들면 그대로 저장하고 다음으로 넘어가면 됩니다.</p>
                </div>
              ) : null}

              {currentStep.kind === "template" ? (
                <div className="space-y-4">
                  {tourData.templates.length > 0 ? (
                    <TourField label="기존 템플릿 사용" hint="새로 만들 수도 있어요">
                      <select value={templateChoice} onChange={(event) => setTemplateChoice(event.target.value)} className={TOUR_CONTROL_CLASS}>
                        <option value="new">새 템플릿 입력</option>
                        {tourData.templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.title}
                          </option>
                        ))}
                      </select>
                    </TourField>
                  ) : null}

                  {templateChoice === "new" ? (
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <TourField label="템플릿 제목" required hint="예: 단골 A방">
                          <input value={templateTitle} onChange={(event) => setTemplateTitle(event.target.value)} className={TOUR_CONTROL_CLASS} placeholder="자주 쓰는 배송 정보" autoFocus />
                        </TourField>
                        <TourField label="구매자">
                          <input value={templateBuyerName} onChange={(event) => setTemplateBuyerName(event.target.value)} className={TOUR_CONTROL_CLASS} />
                        </TourField>
                        <TourField label="수취인">
                          <input value={templateRecipientName} onChange={(event) => setTemplateRecipientName(event.target.value)} className={TOUR_CONTROL_CLASS} />
                        </TourField>
                        <TourField label="아이디">
                          <input value={templateLoginId} onChange={(event) => setTemplateLoginId(event.target.value)} className={TOUR_CONTROL_CLASS} autoComplete="username" />
                        </TourField>
                        <TourField label="연락처">
                          <input value={templatePhone} onChange={(event) => setTemplatePhone(event.target.value)} className={TOUR_CONTROL_CLASS} inputMode="tel" autoComplete="tel" />
                        </TourField>
                        <TourField label="예금주">
                          <input value={templateAccountHolder} onChange={(event) => setTemplateAccountHolder(event.target.value)} className={TOUR_CONTROL_CLASS} />
                        </TourField>
                      </div>
                      <TourField label="주소">
                        <textarea value={templateAddress} onChange={(event) => setTemplateAddress(event.target.value)} className={TOUR_TEXTAREA_CLASS} />
                      </TourField>
                      <TourField label="은행계좌번호" hint="필요할 때만 입력">
                        <input value={templateBankAccountNumber} onChange={(event) => setTemplateBankAccountNumber(event.target.value)} className={TOUR_CONTROL_CLASS} inputMode="numeric" />
                      </TourField>
                    </div>
                  ) : (
                    <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-relaxed text-emerald-950">
                      선택한 템플릿을 새 주문의 기본값으로 지정할 수 있습니다.
                    </p>
                  )}

                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-hairline px-3 py-2.5 text-sm">
                    <input type="checkbox" checked={useTemplateAsDefault} onChange={(event) => setUseTemplateAsDefault(event.target.checked)} className="h-5 w-5 accent-primary" />
                    <span>
                      <span className="block font-medium">새 주문의 기본 템플릿으로 사용</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">나중에 주문 기본값에서 바꿀 수 있어요.</span>
                    </span>
                  </label>
                  <p className="text-xs leading-relaxed text-muted-foreground">주소·계좌번호 같은 민감한 정보는 필요한 범위에서만 저장해 주세요.</p>
                </div>
              ) : null}

              {currentStep.kind === "defaults" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TourField label="결제 플랫폼">
                      <select value={defaultPlatformId} onChange={(event) => setDefaultPlatformId(event.target.value)} className={TOUR_CONTROL_CLASS}>
                        <option value="">최근 사용값 사용</option>
                        {tourData.master.platforms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </TourField>
                    <TourField label="결제 수단">
                      <select value={defaultPaymentMethodId} onChange={(event) => setDefaultPaymentMethodId(event.target.value)} className={TOUR_CONTROL_CLASS}>
                        <option value="">최근 사용값 사용</option>
                        {tourData.master.paymentMethods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </TourField>
                    <TourField label="구매 계정">
                      <select value={defaultBuyerAccountId} onChange={(event) => setDefaultBuyerAccountId(event.target.value)} className={TOUR_CONTROL_CLASS}>
                        <option value="">최근 사용값 사용</option>
                        {tourData.master.buyerAccounts.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                      </select>
                    </TourField>
                    <TourField label="구매 정보 템플릿">
                      <select value={defaultPurchaseInfoTemplateId} onChange={(event) => setDefaultPurchaseInfoTemplateId(event.target.value)} className={TOUR_CONTROL_CLASS}>
                        <option value="">최근 사용값 사용</option>
                        {tourData.templates.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                      </select>
                    </TourField>
                    <TourField label="주문 저장 후">
                      <select value={orderSaveAction} onChange={(event) => setOrderSaveAction(event.target.value as OrderSaveAction)} className={TOUR_CONTROL_CLASS}>
                        <option value="ledger">구매장부로 이동</option>
                        <option value="same">같은 정보로 계속 등록</option>
                        <option value="blank">빈 입력 화면 열기</option>
                      </select>
                    </TourField>
                    <TourField label="구매장부 밀도">
                      <select value={ledgerDensity} onChange={(event) => setLedgerDensity(event.target.value as LedgerDensity)} className={TOUR_CONTROL_CLASS}>
                        <option value="compact">촘촘하게</option>
                        <option value="comfortable">편안하게</option>
                      </select>
                    </TourField>
                  </div>
                  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-hairline px-3 py-2.5 text-sm">
                    <span>
                      <span className="block font-medium">자동추천 연속 처리</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">추천을 저장한 뒤 다음 대기 항목으로 이동합니다.</span>
                    </span>
                    <input type="checkbox" checked={autoAdvanceRecommendations} onChange={(event) => setAutoAdvanceRecommendations(event.target.checked)} className="h-5 w-5 accent-primary" />
                  </label>
                  <p className="text-xs leading-relaxed text-muted-foreground">선택할 항목이 아직 없다면 ‘최근 사용값 사용’으로 두고 나중에 설정해도 됩니다.</p>
                </div>
              ) : null}

              {currentStep.kind === "ai" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TourField label="성별" hint="선택">
                      <input value={aiGender} onChange={(event) => setAiGender(event.target.value)} className={TOUR_CONTROL_CLASS} placeholder="예: 여성" />
                    </TourField>
                    <TourField label="나이대" hint="선택">
                      <input value={aiAgeRange} onChange={(event) => setAiAgeRange(event.target.value)} className={TOUR_CONTROL_CLASS} placeholder="예: 30대" />
                    </TourField>
                  </div>
                  <TourField label="거주 지역" hint="광역·시 단위 권장">
                    <input value={aiRegion} onChange={(event) => setAiRegion(event.target.value)} className={TOUR_CONTROL_CLASS} placeholder="예: 경기 성남" />
                  </TourField>
                  <TourField label="직업·생활 맥락" hint="선택">
                    <input value={aiOccupation} onChange={(event) => setAiOccupation(event.target.value)} className={TOUR_CONTROL_CLASS} placeholder="예: 사무직, 육아 중" />
                  </TourField>
                  <TourField label="추가 설명" hint="리뷰 말투·취향 등">
                    <textarea value={aiExtraContext} onChange={(event) => setAiExtraContext(event.target.value)} className={TOUR_TEXTAREA_CLASS} placeholder="부담 없는 범위에서만 적어 주세요." />
                  </TourField>
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-950">이 단계에는 이름·전화번호·주소 같은 개인정보를 넣지 마세요.</p>
                </div>
              ) : null}

              {currentStep.kind === "finish" ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-950">
                  <div className="flex items-start gap-3">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                    <p>저장한 내용은 주문 추가 화면의 기본값과 AI 리뷰 생성에 바로 연결됩니다.</p>
                  </div>
                </div>
              ) : null}
            </div>

            {errorMessage ? (
              <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive" role="alert">
                {errorMessage}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-hairline px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-2">
              {stepIndex > 0 ? (
                <button type="button" onClick={goBack} disabled={isSavingStep || isCompleting} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50">
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  이전
                </button>
              ) : null}
              {isSettingStep && !isLastStep ? (
                <button type="button" onClick={advance} disabled={isSavingStep || isCompleting} className="min-h-11 rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50">
                  나중에 설정
                </button>
              ) : null}
            </div>
            <button type="button" onClick={() => void handleNext()} disabled={isSavingStep || isCompleting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-active disabled:cursor-not-allowed disabled:opacity-50">
              {isSavingStep || isCompleting ? "저장 중…" : isLastStep ? "완료" : stepIndex === 0 ? "시작하기" : isSettingStep ? "저장하고 계속" : "다음"}
              {!isSavingStep && !isCompleting && !isLastStep ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
