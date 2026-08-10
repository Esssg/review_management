"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HexColorInput, HexColorPicker } from "react-colorful";
import { ArrowLeft, ChevronRight, Plus, Trash2 } from "lucide-react";

import { OrderTrashPanel } from "@/components/settings/order-trash-panel";
import { AiReviewSettingsView } from "@/components/settings/ai-review-settings-view";
import { PurchaseTemplatesSettingsView } from "@/components/settings/purchase-templates-settings-view";
import { PwaInstallCard } from "@/components/pwa/pwa-install-card";
import {
  DEFAULT_BUYER_ACCOUNT_COLOR,
  DEFAULT_PAYMENT_METHOD_COLOR,
  DEFAULT_PLATFORM_COLOR,
  type SettingsCatalogItem,
  useSettingsCatalog,
} from "@/components/settings/use-settings-catalog";
import { useSettingsPreferences } from "@/components/settings/use-settings-preferences";
import { useSettingsProfile } from "@/components/settings/use-settings-profile";
import { normalizeHexColor } from "@/lib/color";
import type { PurchaseTemplateRow } from "@/lib/kakao-purchase-paste";
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
  | "buyer-accounts"
  | "trash";

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

const VIEW_TITLES: Record<Exclude<SettingsPanelView, "home">, string> = {
  account: "계정",
  nickname: "닉네임 변경",
  defaults: "주문 기본값",
  "purchase-templates": "구매 정보 템플릿",
  ai: "AI 설정 관리",
  platforms: "결제 플랫폼 관리",
  "payment-methods": "결제 수단 관리",
  "buyer-accounts": "구매 계정 관리",
  trash: "주문 휴지통",
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

function PlatformSettingsView({
  header,
  alerts,
  platformsWithMeta,
  deletingId,
  savingColorId,
  onDeletePlatform,
  onChangePlatformColor,
  onAddPlatform,
}: {
  header: ReactNode;
  alerts: ReactNode;
  platformsWithMeta: SettingsCatalogItem<Platform>[];
  deletingId: string | null;
  savingColorId: string | null;
  onDeletePlatform: (platform: Platform) => void | Promise<void>;
  onChangePlatformColor: (platform: Platform, nextColor: string) => Promise<void>;
  onAddPlatform: (name: string, color: string) => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-4">
      {header}
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
            platformsWithMeta.map((platform) => (
              <ItemRow
                key={platform.id}
                label={platform.name}
                color={platform.color}
                isSystem={platform.isSystem}
                isHidden={platform.isHidden}
                canEditColor={!platform.isSystem}
                isDeleting={deletingId === platform.id}
                isSavingColor={savingColorId === platform.id}
                onDelete={() => void onDeletePlatform(platform)}
                onChangeColor={(next) => onChangePlatformColor(platform, next)}
              />
            ))
          )}
        </div>
        <div className="mt-3">
          <AddItemForm
            placeholder="새 플랫폼 이름"
            defaultColor={DEFAULT_PLATFORM_COLOR}
            onAdd={onAddPlatform}
          />
        </div>
      </section>
    </div>
  );
}

function PaymentMethodSettingsView({
  header,
  alerts,
  methodsWithMeta,
  deletingId,
  savingColorId,
  onDeletePaymentMethod,
  onChangePaymentMethodColor,
  onAddPaymentMethod,
}: {
  header: ReactNode;
  alerts: ReactNode;
  methodsWithMeta: SettingsCatalogItem<PaymentMethod>[];
  deletingId: string | null;
  savingColorId: string | null;
  onDeletePaymentMethod: (method: PaymentMethod) => void | Promise<void>;
  onChangePaymentMethodColor: (method: PaymentMethod, nextColor: string) => Promise<void>;
  onAddPaymentMethod: (name: string, color: string) => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-4">
      {header}
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
            methodsWithMeta.map((method) => (
              <ItemRow
                key={method.id}
                label={method.name}
                color={method.color}
                isSystem={method.isSystem}
                isHidden={method.isHidden}
                canEditColor={!method.isSystem}
                isDeleting={deletingId === method.id}
                isSavingColor={savingColorId === method.id}
                onDelete={() => void onDeletePaymentMethod(method)}
                onChangeColor={(next) => onChangePaymentMethodColor(method, next)}
              />
            ))
          )}
        </div>
        <div className="mt-3">
          <AddItemForm
            placeholder="새 결제 수단 이름"
            defaultColor={DEFAULT_PAYMENT_METHOD_COLOR}
            onAdd={onAddPaymentMethod}
          />
        </div>
      </section>
    </div>
  );
}

function BuyerAccountSettingsView({
  header,
  alerts,
  buyerAccounts,
  deletingId,
  savingColorId,
  onDeleteBuyerAccount,
  onChangeBuyerAccountColor,
  onAddBuyerAccount,
}: {
  header: ReactNode;
  alerts: ReactNode;
  buyerAccounts: BuyerAccount[];
  deletingId: string | null;
  savingColorId: string | null;
  onDeleteBuyerAccount: (account: BuyerAccount) => void | Promise<void>;
  onChangeBuyerAccountColor: (account: BuyerAccount, nextColor: string) => Promise<void>;
  onAddBuyerAccount: (label: string, color: string) => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-4">
      {header}
      {alerts}
      <section className="rounded-lg border border-hairline bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]">
        <SectionHeader title="구매 계정" description="주문 시 선택할 구매자 계정 별칭을 관리합니다." />
        <div className="flex flex-col gap-2">
          {buyerAccounts.length === 0 ? (
            <p className="text-muted-foreground text-sm">등록된 계정이 없습니다.</p>
          ) : (
            buyerAccounts.map((account) => (
              <ItemRow
                key={account.id}
                label={account.label}
                color={account.color}
                isSystem={false}
                isHidden={false}
                canEditColor
                isDeleting={deletingId === account.id}
                isSavingColor={savingColorId === account.id}
                onDelete={() => void onDeleteBuyerAccount(account)}
                onChangeColor={(next) => onChangeBuyerAccountColor(account, next)}
              />
            ))
          )}
        </div>
        <div className="mt-3">
          <AddItemForm
            placeholder="새 계정 별칭 (예: 혜미)"
            defaultColor={DEFAULT_BUYER_ACCOUNT_COLOR}
            onAdd={onAddBuyerAccount}
          />
        </div>
      </section>
    </div>
  );
}

function AccountSettingsView({
  header,
  alerts,
  displayName,
  accountEmail,
  onOpenNicknameEdit,
}: {
  header: ReactNode;
  alerts: ReactNode;
  displayName: string;
  accountEmail: string;
  onOpenNicknameEdit: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {header}
      {alerts}
      <section className="flex flex-col gap-1 rounded-lg border border-hairline bg-card p-2 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]">
        <button
          type="button"
          onClick={onOpenNicknameEdit}
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

function NicknameSettingsView({
  header,
  alerts,
  nicknameDraft,
  nicknameSaveDisabled,
  isSaving,
  onNicknameChange,
  onSave,
}: {
  header: ReactNode;
  alerts: ReactNode;
  nicknameDraft: string;
  nicknameSaveDisabled: boolean;
  isSaving: boolean;
  onNicknameChange: (value: string) => void;
  onSave: () => void | Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-4">
      {header}
      {alerts}
      <section className="rounded-lg border border-hairline bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">닉네임</span>
          <input
            value={nicknameDraft}
            onChange={(event) => onNicknameChange(event.target.value)}
            placeholder="표시 이름"
            autoComplete="nickname"
            className="h-11 rounded-[4px] border border-input bg-card px-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <button
          type="button"
          disabled={nicknameSaveDisabled}
          onClick={() => void onSave()}
          className={cn(
            "mt-4 inline-flex h-11 w-full touch-manipulation items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors",
            nicknameSaveDisabled
              ? "cursor-not-allowed bg-muted text-muted-foreground"
              : "bg-primary text-primary-foreground hover:bg-primary-active",
          )}
        >
          {isSaving ? "저장 중…" : "저장"}
        </button>
      </section>
    </div>
  );
}

function OrderDefaultsSettingsView({
  header,
  alerts,
  preferences,
  platforms,
  paymentMethods,
  buyerAccounts,
  purchaseTemplates,
  isHidden,
  onUpdatePreferences,
}: {
  header: ReactNode;
  alerts: ReactNode;
  preferences: UserPreferences;
  platforms: Platform[];
  paymentMethods: PaymentMethod[];
  buyerAccounts: BuyerAccount[];
  purchaseTemplates: PurchaseTemplateRow[];
  isHidden: (targetId: string, itemType: string) => boolean;
  onUpdatePreferences: (
    patch: Database["public"]["Tables"]["user_preferences"]["Update"],
  ) => Promise<boolean>;
}) {
  return (
    <div className="flex flex-col gap-4">
      {header}
      {alerts}
      <section className="rounded-lg border border-hairline bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] sm:p-5">
        <SectionHeader
          title="새 주문 기본값"
          description="선택한 값은 새 주문을 열 때 먼저 적용됩니다. 지정하지 않은 항목은 마지막 저장 주문의 값을 사용합니다."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">결제 플랫폼</span>
            <select value={preferences.default_platform_id ?? ""} onChange={(event) => void onUpdatePreferences({ default_platform_id: event.target.value || null })} className="h-10 rounded-xl border border-input bg-background px-3">
              <option value="">최근 사용값</option>
              {platforms.filter((item) => !isHidden(item.id, "platform")).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">결제 수단</span>
            <select value={preferences.default_payment_method_id ?? ""} onChange={(event) => void onUpdatePreferences({ default_payment_method_id: event.target.value || null })} className="h-10 rounded-xl border border-input bg-background px-3">
              <option value="">최근 사용값</option>
              {paymentMethods.filter((item) => !isHidden(item.id, "payment_method")).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">구매 계정</span>
            <select value={preferences.default_buyer_account_id ?? ""} onChange={(event) => void onUpdatePreferences({ default_buyer_account_id: event.target.value || null })} className="h-10 rounded-xl border border-input bg-background px-3">
              <option value="">최근 사용값</option>
              {buyerAccounts.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">구매 정보 템플릿</span>
            <select value={preferences.default_purchase_info_template_id ?? ""} onChange={(event) => void onUpdatePreferences({ default_purchase_info_template_id: event.target.value || null })} className="h-10 rounded-xl border border-input bg-background px-3">
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
            <select value={preferences.order_save_action} onChange={(event) => void onUpdatePreferences({ order_save_action: event.target.value as OrderSaveAction })} className="h-10 rounded-xl border border-input bg-background px-3">
              <option value="ledger">구매장부로 이동</option>
              <option value="same">같은 정보로 계속 등록</option>
              <option value="blank">빈 입력 화면 열기</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">구매장부 밀도</span>
            <select value={preferences.ledger_density} onChange={(event) => void onUpdatePreferences({ ledger_density: event.target.value })} className="h-10 rounded-xl border border-input bg-background px-3">
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
          <input type="checkbox" checked={preferences.auto_advance_recommendations} onChange={(event) => void onUpdatePreferences({ auto_advance_recommendations: event.target.checked })} className="h-5 w-5 accent-primary" />
        </label>
      </section>
    </div>
  );
}

function SettingsHomeView({
  alerts,
  displayName,
  accountEmail,
  purchaseTemplateCount,
  trashCount,
  onNavigate,
  onLogout,
}: {
  alerts: ReactNode;
  displayName: string;
  accountEmail: string;
  purchaseTemplateCount: number;
  trashCount: number;
  onNavigate: (view: SettingsPanelView) => void;
  onLogout: () => void | Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-5">
      {alerts}
      <PwaInstallCard />

      <button
        type="button"
        onClick={() => onNavigate("account")}
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
        <SettingsNavRow label="주문 기본값" description="기본 항목·저장 후 동작" onClick={() => onNavigate("defaults")} />
        <SettingsNavRow label="구매 정보 템플릿" description={`${purchaseTemplateCount}개 저장됨`} onClick={() => onNavigate("purchase-templates")} />
        <SettingsNavRow label="AI 설정 관리" description="리뷰 생성 기본 정보" onClick={() => onNavigate("ai")} />
        <SettingsNavRow label="결제플랫폼 관리" onClick={() => onNavigate("platforms")} />
        <SettingsNavRow label="결제수단 관리" onClick={() => onNavigate("payment-methods")} />
        <SettingsNavRow label="구매계정 관리" onClick={() => onNavigate("buyer-accounts")} />
        <SettingsNavRow label="주문 휴지통" description="삭제 주문 복원·영구 삭제" badge={`${trashCount}건`} onClick={() => onNavigate("trash")} />
      </div>

      <SettingsNavRow label="공지사항" disabled badge="준비 중" />

      <button
        type="button"
        onClick={() => void onLogout()}
        className="min-h-12 w-full touch-manipulation rounded-full border border-red-200 bg-card py-3 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50 active:bg-red-100 dark:border-red-900/60 dark:bg-slate-800 dark:text-red-500 dark:hover:bg-red-950/40"
      >
        로그아웃하기
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
  initialTemplateUsageCountsLoaded,
  onLoadTemplateUsageCounts,
  initialTrashCount,
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
  initialTemplateUsageCountsLoaded: boolean;
  onLoadTemplateUsageCounts: () => Promise<Record<string, number>>;
  initialTrashCount: number;
  initialPreferences: UserPreferences;
  initialAiReviewProfile: Database["public"]["Tables"]["user_ai_review_profiles"]["Row"] | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [view, setView] = useState<SettingsPanelView>(initialView);
  const [accountEmail] = useState(initialEmail);
  const [trashCount, setTrashCount] = useState(initialTrashCount);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const showSuccessMessage = useCallback((message: string) => {
    setSuccessMessage(message);
    window.setTimeout(() => setSuccessMessage(""), 3500);
  }, []);

  const {
    displayName,
    nicknameDraft,
    isSavingName,
    nicknameSaveDisabled,
    aiGender,
    aiAgeRange,
    aiRegion,
    aiOccupation,
    aiExtraContext,
    isSavingAiProfile,
    setNicknameDraft,
    setAiGender,
    setAiAgeRange,
    setAiRegion,
    setAiOccupation,
    setAiExtraContext,
    handleSaveNickname: saveNickname,
    handleSaveAiReviewProfile,
  } = useSettingsProfile({
    userId,
    initialDisplayName,
    initialAiReviewProfile,
    supabase,
    onError: setErrorMessage,
    onSuccess: showSuccessMessage,
  });

  const catalog = useSettingsCatalog({
    userId,
    supabase,
    initialPlatforms,
    initialPaymentMethods,
    initialBuyerAccounts,
    hiddenSettings,
    onError: setErrorMessage,
  });

  const {
    platforms,
    paymentMethods,
    buyerAccounts,
    isHidden,
    platformsWithMeta,
    methodsWithMeta,
    deletingId,
    savingColorId,
    handleDeletePlatform,
    handleDeletePaymentMethod,
    handleDeleteBuyerAccount,
    handleAddPlatform,
    handleAddPaymentMethod,
    handleAddBuyerAccount,
    handlePlatformColorChange,
    handlePaymentMethodColorChange,
    handleBuyerAccountColorChange,
  } = catalog;

  const {
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
  } = useSettingsPreferences({
    userId,
    view,
    initialPurchaseTemplates,
    templateUsageCounts,
    initialTemplateUsageCountsLoaded,
    onLoadTemplateUsageCounts,
    initialPreferences,
    supabase,
    onError: setErrorMessage,
    onSuccess: showSuccessMessage,
  });

  const goBack = useCallback(() => {
    setErrorMessage("");
    if (view === "account") setView("home");
    else if (view === "nickname") {
      setNicknameDraft(displayName);
      setView("account");
    } else if (view !== "home") setView("home");
  }, [displayName, setNicknameDraft, view]);

  const openNicknameEdit = () => {
    setNicknameDraft(displayName);
    setView("nickname");
  };

  const handleSaveNickname = useCallback(async () => {
    const saved = await saveNickname();
    if (saved) setView("account");
  }, [saveNickname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
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
      <NicknameSettingsView
        header={subHeader}
        alerts={alerts}
        nicknameDraft={nicknameDraft}
        nicknameSaveDisabled={nicknameSaveDisabled}
        isSaving={isSavingName}
        onNicknameChange={setNicknameDraft}
        onSave={handleSaveNickname}
      />
    );
  }

  if (view === "account") {
    return (
      <AccountSettingsView
        header={subHeader}
        alerts={alerts}
        displayName={displayName}
        accountEmail={accountEmail}
        onOpenNicknameEdit={openNicknameEdit}
      />
    );
  }

  if (view === "defaults") {
    return (
      <OrderDefaultsSettingsView
        header={subHeader}
        alerts={alerts}
        preferences={preferences}
        platforms={platforms}
        paymentMethods={paymentMethods}
        buyerAccounts={buyerAccounts}
        purchaseTemplates={purchaseTemplates}
        isHidden={isHidden}
        onUpdatePreferences={updatePreferences}
      />
    );
  }

  if (view === "purchase-templates") {
    return (
      <PurchaseTemplatesSettingsView
        header={subHeader}
        alerts={alerts}
        purchaseTemplates={purchaseTemplates}
        defaultTemplateId={preferences.default_purchase_info_template_id}
        usageCounts={usageCounts}
        isTemplateUsageCountsLoaded={isTemplateUsageCountsLoaded}
        isLoadingTemplateUsageCounts={isLoadingTemplateUsageCounts}
        onSetDefault={setDefaultPurchaseTemplate}
        onClone={clonePurchaseTemplate}
        onCopy={handleCopyPurchaseTemplate}
        onDelete={deletePurchaseTemplate}
      />
    );
  }

  if (view === "ai") {
    return (
      <AiReviewSettingsView
        header={subHeader}
        alerts={alerts}
        gender={aiGender}
        ageRange={aiAgeRange}
        region={aiRegion}
        occupation={aiOccupation}
        extraContext={aiExtraContext}
        isSaving={isSavingAiProfile}
        onGenderChange={setAiGender}
        onAgeRangeChange={setAiAgeRange}
        onRegionChange={setAiRegion}
        onOccupationChange={setAiOccupation}
        onExtraContextChange={setAiExtraContext}
        onSave={handleSaveAiReviewProfile}
      />
    );
  }

  if (view === "platforms") {
    return (
      <PlatformSettingsView
        header={subHeader}
        alerts={alerts}
        platformsWithMeta={platformsWithMeta}
        deletingId={deletingId}
        savingColorId={savingColorId}
        onDeletePlatform={handleDeletePlatform}
        onChangePlatformColor={handlePlatformColorChange}
        onAddPlatform={handleAddPlatform}
      />
    );
  }

  if (view === "payment-methods") {
    return (
      <PaymentMethodSettingsView
        header={subHeader}
        alerts={alerts}
        methodsWithMeta={methodsWithMeta}
        deletingId={deletingId}
        savingColorId={savingColorId}
        onDeletePaymentMethod={handleDeletePaymentMethod}
        onChangePaymentMethodColor={handlePaymentMethodColorChange}
        onAddPaymentMethod={handleAddPaymentMethod}
      />
    );
  }

  if (view === "buyer-accounts") {
    return (
      <BuyerAccountSettingsView
        header={subHeader}
        alerts={alerts}
        buyerAccounts={buyerAccounts}
        deletingId={deletingId}
        savingColorId={savingColorId}
        onDeleteBuyerAccount={handleDeleteBuyerAccount}
        onChangeBuyerAccountColor={handleBuyerAccountColorChange}
        onAddBuyerAccount={handleAddBuyerAccount}
      />
    );
  }

  if (view === "trash") {
    return (
      <div className="flex flex-col gap-4">
        {subHeader}
        {alerts}
        <OrderTrashPanel userId={userId} onCountChange={setTrashCount} />
      </div>
    );
  }

  /* home */
  return (
    <SettingsHomeView
      alerts={alerts}
      displayName={displayName}
      accountEmail={accountEmail}
      purchaseTemplateCount={purchaseTemplates.length}
      trashCount={trashCount}
      onNavigate={setView}
      onLogout={handleLogout}
    />
  );
}
