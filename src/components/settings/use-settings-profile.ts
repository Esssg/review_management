import { useCallback, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type SettingsProfileOptions = {
  userId: string;
  initialDisplayName: string;
  initialAiReviewProfile: Database["public"]["Tables"]["user_ai_review_profiles"]["Row"] | null;
  supabase: SupabaseClient<Database>;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

/** 계정 표시 이름과 AI 리뷰 기본 정보의 입력·저장 책임을 부모 화면에서 분리합니다. */
export function useSettingsProfile({
  userId,
  initialDisplayName,
  initialAiReviewProfile,
  supabase,
  onError,
  onSuccess,
}: SettingsProfileOptions) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [nicknameDraft, setNicknameDraft] = useState(initialDisplayName);
  const [isSavingName, setIsSavingName] = useState(false);
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

  const handleSaveNickname = useCallback(async () => {
    if (nicknameSaveDisabled) return false;
    onError("");
    setIsSavingName(true);
    try {
      const { error } = await supabase.from("users").update({ name: trimmedDraft }).eq("user_id", userId);
      if (error) {
        onError(error.message);
        return false;
      }
      setDisplayName(trimmedDraft);
      onSuccess("닉네임을 저장했습니다.");
      return true;
    } finally {
      setIsSavingName(false);
    }
  }, [nicknameSaveDisabled, onError, onSuccess, supabase, trimmedDraft, userId]);

  const handleSaveAiReviewProfile = useCallback(async () => {
    onError("");
    onSuccess("");
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
        onError(error.message);
        return;
      }
      onSuccess("AI 리뷰 기본 정보를 저장했습니다.");
    } finally {
      setIsSavingAiProfile(false);
    }
  }, [aiAgeRange, aiExtraContext, aiGender, aiOccupation, aiRegion, onError, onSuccess, supabase, userId]);

  return {
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
    handleSaveNickname,
    handleSaveAiReviewProfile,
  };
}
