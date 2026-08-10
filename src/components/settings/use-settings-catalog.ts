import { useCallback, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeHexColor } from "@/lib/color";
import type { BuyerAccount, PaymentMethod, Platform } from "@/lib/master-data";
import type { Database } from "@/types/database";

type UserItemSetting = Database["public"]["Tables"]["user_item_settings"]["Row"];

export type SettingsCatalogItem<T> = T & { isSystem: boolean; isHidden: boolean };

export const DEFAULT_PLATFORM_COLOR = "#64748b";
export const DEFAULT_PAYMENT_METHOD_COLOR = "#7c3aed";
export const DEFAULT_BUYER_ACCOUNT_COLOR = "#64748b";

type SettingsCatalogOptions = {
  userId: string;
  supabase: SupabaseClient<Database>;
  initialPlatforms: Platform[];
  initialPaymentMethods: PaymentMethod[];
  initialBuyerAccounts: BuyerAccount[];
  hiddenSettings: UserItemSetting[];
  onError: (message: string) => void;
};

/** 설정의 master data 조회 결과와 추가·삭제·색상 변경 mutation을 한 책임으로 묶습니다. */
export function useSettingsCatalog({
  userId,
  supabase,
  initialPlatforms,
  initialPaymentMethods,
  initialBuyerAccounts,
  hiddenSettings,
  onError,
}: SettingsCatalogOptions) {
  const [platforms, setPlatforms] = useState<Platform[]>(initialPlatforms);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(initialPaymentMethods);
  const [buyerAccounts, setBuyerAccounts] = useState<BuyerAccount[]>(initialBuyerAccounts);
  const [hidden, setHidden] = useState<UserItemSetting[]>(hiddenSettings);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingColorId, setSavingColorId] = useState<string | null>(null);

  const hiddenItemKeys = useMemo(
    () => new Set(hidden.filter((item) => item.is_hidden).map((item) => `${item.item_type}:${item.target_id}`)),
    [hidden],
  );
  const isHidden = useCallback(
    (targetId: string, itemType: string) => hiddenItemKeys.has(`${itemType}:${targetId}`),
    [hiddenItemKeys],
  );

  const handleDeletePlatform = useCallback(async (platform: Platform) => {
    setDeletingId(platform.id);
    onError("");
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
            onError(error.message);
            return;
          }
          setHidden((prev) => prev.filter((s) => !(s.target_id === platform.id && s.item_type === "platform")));
        } else {
          const { error } = await supabase
            .from("user_item_settings")
            .upsert({ user_id: userId, target_id: platform.id, item_type: "platform", is_hidden: true });
          if (error) {
            onError(error.message);
            return;
          }
          setHidden((prev) => [
            ...prev,
            { user_id: userId, target_id: platform.id, item_type: "platform", is_hidden: true },
          ]);
        }
      } else {
        const confirmed = window.confirm(`"${platform.name}" 플랫폼을 삭제할까요?`);
        if (!confirmed) return;
        const { error } = await supabase.from("platforms").delete().eq("id", platform.id);
        if (error) {
          onError(error.message);
          return;
        }
        setPlatforms((prev) => prev.filter((p) => p.id !== platform.id));
      }
    } finally {
      setDeletingId(null);
    }
  }, [isHidden, onError, supabase, userId]);

  const handleDeletePaymentMethod = useCallback(async (method: PaymentMethod) => {
    setDeletingId(method.id);
    onError("");
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
            onError(error.message);
            return;
          }
          setHidden((prev) => prev.filter((s) => !(s.target_id === method.id && s.item_type === "payment_method")));
        } else {
          const { error } = await supabase
            .from("user_item_settings")
            .upsert({ user_id: userId, target_id: method.id, item_type: "payment_method", is_hidden: true });
          if (error) {
            onError(error.message);
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
          onError(error.message);
          return;
        }
        setPaymentMethods((prev) => prev.filter((m) => m.id !== method.id));
      }
    } finally {
      setDeletingId(null);
    }
  }, [isHidden, onError, supabase, userId]);

  const handleDeleteBuyerAccount = useCallback(async (account: BuyerAccount) => {
    const confirmed = window.confirm(`"${account.label}" 계정을 삭제할까요?`);
    if (!confirmed) return;
    setDeletingId(account.id);
    onError("");
    try {
      const { error } = await supabase.from("buyer_accounts").delete().eq("id", account.id);
      if (error) {
        onError(error.message);
        return;
      }
      setBuyerAccounts((prev) => prev.filter((a) => a.id !== account.id));
    } finally {
      setDeletingId(null);
    }
  }, [onError, supabase]);

  const handleAddPlatform = useCallback(async (name: string, color: string) => {
    const { data, error } = await supabase
      .from("platforms")
      .insert({ name, user_id: userId, color: normalizeHexColor(color, DEFAULT_PLATFORM_COLOR) })
      .select("id, name, user_id, color")
      .single();
    if (error) {
      onError(error.message);
      return;
    }
    setPlatforms((prev) => [...prev, data]);
  }, [onError, supabase, userId]);

  const handleAddPaymentMethod = useCallback(async (name: string, color: string) => {
    const { data, error } = await supabase
      .from("payment_methods")
      .insert({ name, user_id: userId, color: normalizeHexColor(color, DEFAULT_PAYMENT_METHOD_COLOR) })
      .select("id, name, user_id, color")
      .single();
    if (error) {
      onError(error.message);
      return;
    }
    setPaymentMethods((prev) => [...prev, data]);
  }, [onError, supabase, userId]);

  const handleAddBuyerAccount = useCallback(async (label: string, color: string) => {
    const { data, error } = await supabase
      .from("buyer_accounts")
      .insert({ label, user_id: userId, color: normalizeHexColor(color, DEFAULT_BUYER_ACCOUNT_COLOR) })
      .select("id, label, color")
      .single();
    if (error) {
      onError(error.message);
      return;
    }
    setBuyerAccounts((prev) => [...prev, data]);
  }, [onError, supabase, userId]);

  const platformsWithMeta = useMemo<SettingsCatalogItem<Platform>[]>(() => platforms.map((platform) => ({
    ...platform,
    isSystem: platform.user_id === null,
    isHidden: isHidden(platform.id, "platform"),
  })).sort((a, b) => {
    if (a.isSystem !== b.isSystem) return a.isSystem ? 1 : -1;
    return a.name.localeCompare(b.name, "ko");
  }), [isHidden, platforms]);

  const methodsWithMeta = useMemo<SettingsCatalogItem<PaymentMethod>[]>(() => paymentMethods.map((method) => ({
    ...method,
    isSystem: method.user_id === null,
    isHidden: isHidden(method.id, "payment_method"),
  })).sort((a, b) => {
    if (a.isSystem !== b.isSystem) return a.isSystem ? 1 : -1;
    return a.name.localeCompare(b.name, "ko");
  }), [isHidden, paymentMethods]);

  const handlePlatformColorChange = useCallback(async (platform: Platform, nextColor: string) => {
    if (platform.user_id === null) return;
    const color = normalizeHexColor(nextColor, DEFAULT_PLATFORM_COLOR);
    if (normalizeHexColor(platform.color, DEFAULT_PLATFORM_COLOR) === color) return;
    setSavingColorId(platform.id);
    onError("");
    try {
      const { error } = await supabase.from("platforms").update({ color }).eq("id", platform.id);
      if (error) {
        onError(error.message);
        return;
      }
      setPlatforms((prev) => prev.map((item) => (item.id === platform.id ? { ...item, color } : item)));
    } finally {
      setSavingColorId(null);
    }
  }, [onError, supabase]);

  const handlePaymentMethodColorChange = useCallback(async (method: PaymentMethod, nextColor: string) => {
    if (method.user_id === null) return;
    const color = normalizeHexColor(nextColor, DEFAULT_PAYMENT_METHOD_COLOR);
    if (normalizeHexColor(method.color, DEFAULT_PAYMENT_METHOD_COLOR) === color) return;
    setSavingColorId(method.id);
    onError("");
    try {
      const { error } = await supabase.from("payment_methods").update({ color }).eq("id", method.id);
      if (error) {
        onError(error.message);
        return;
      }
      setPaymentMethods((prev) => prev.map((item) => (item.id === method.id ? { ...item, color } : item)));
    } finally {
      setSavingColorId(null);
    }
  }, [onError, supabase]);

  const handleBuyerAccountColorChange = useCallback(async (account: BuyerAccount, nextColor: string) => {
    const color = normalizeHexColor(nextColor, DEFAULT_BUYER_ACCOUNT_COLOR);
    if (normalizeHexColor(account.color, DEFAULT_BUYER_ACCOUNT_COLOR) === color) return;
    setSavingColorId(account.id);
    onError("");
    try {
      const { error } = await supabase.from("buyer_accounts").update({ color }).eq("id", account.id);
      if (error) {
        onError(error.message);
        return;
      }
      setBuyerAccounts((prev) => prev.map((item) => (item.id === account.id ? { ...item, color } : item)));
    } finally {
      setSavingColorId(null);
    }
  }, [onError, supabase]);

  return {
    platforms,
    paymentMethods,
    buyerAccounts,
    deletingId,
    savingColorId,
    isHidden,
    platformsWithMeta,
    methodsWithMeta,
    handleDeletePlatform,
    handleDeletePaymentMethod,
    handleDeleteBuyerAccount,
    handleAddPlatform,
    handleAddPaymentMethod,
    handleAddBuyerAccount,
    handlePlatformColorChange,
    handlePaymentMethodColorChange,
    handleBuyerAccountColorChange,
  };
}
