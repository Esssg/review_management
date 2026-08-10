import type { ReactNode } from "react";

export function AiReviewSettingsView({
  header,
  alerts,
  gender,
  ageRange,
  region,
  occupation,
  extraContext,
  isSaving,
  onGenderChange,
  onAgeRangeChange,
  onRegionChange,
  onOccupationChange,
  onExtraContextChange,
  onSave,
}: {
  header: ReactNode;
  alerts: ReactNode;
  gender: string;
  ageRange: string;
  region: string;
  occupation: string;
  extraContext: string;
  isSaving: boolean;
  onGenderChange: (value: string) => void;
  onAgeRangeChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onOccupationChange: (value: string) => void;
  onExtraContextChange: (value: string) => void;
  onSave: () => void | Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-4">
      {header}
      {alerts}
      <section className="rounded-lg border border-hairline bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]">
        <div className="mb-3">
          <h2 className="text-base font-semibold">AI 리뷰 기본 정보</h2>
          <p className="text-ink-muted mt-0.5 text-sm leading-relaxed">
            이름·전화번호 등 민감한 개인정보는 넣지 마세요. 성별·나이대·거주 지역 정도만 저장해 리뷰 톤을 맞출 때 사용합니다.
          </p>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">성별</span>
            <input
              value={gender}
              onChange={(event) => onGenderChange(event.target.value)}
              placeholder="예: 여성"
              className="h-10 rounded-[4px] border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">나이대</span>
            <input
              value={ageRange}
              onChange={(event) => onAgeRangeChange(event.target.value)}
              placeholder="예: 30대"
              className="h-10 rounded-[4px] border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium">거주 지역</span>
            <input
              value={region}
              onChange={(event) => onRegionChange(event.target.value)}
              placeholder="예: 경기 성남 (구체적 주소는 비추천)"
              className="h-10 rounded-[4px] border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium">직업·생활 맥락</span>
            <input
              value={occupation}
              onChange={(event) => onOccupationChange(event.target.value)}
              placeholder="예: 사무직, 육아 중 등"
              className="h-10 rounded-[4px] border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium">추가 설명</span>
            <textarea
              value={extraContext}
              onChange={(event) => onExtraContextChange(event.target.value)}
              rows={3}
              placeholder="리뷰 말투·취향 등 부담 없이 적을 수 있는 범위에서만 적어 주세요."
              className="min-h-[5rem] resize-y rounded-[4px] border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void onSave()}
          className="mt-4 inline-flex h-10 w-full touch-manipulation items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50 sm:w-auto"
        >
          {isSaving ? "저장 중…" : "AI 리뷰 기본 정보 저장"}
        </button>
      </section>
    </div>
  );
}
