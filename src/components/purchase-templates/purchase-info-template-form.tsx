"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ClipboardList, Copy } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildKakaoPasteLine, type PurchaseTemplateRow } from "@/lib/kakao-purchase-paste";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Insert = Database["public"]["Tables"]["purchase_info_templates"]["Insert"];
type Update = Database["public"]["Tables"]["purchase_info_templates"]["Update"];

function FormRow({
  label,
  required = false,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 py-4">
      <div className="mb-2 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
        <Label className="text-foreground text-sm font-medium">
          {label}
          {required ? <span className="text-destructive ml-0.5">*</span> : null}
        </Label>
        {hint ? <span className="text-muted-foreground text-xs font-normal">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

const textareaClass = cn(
  "min-h-[5rem] w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors",
  "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
  "dark:bg-input/30",
);

export function PurchaseInfoTemplateForm({ template }: { template?: PurchaseTemplateRow }) {
  const isEdit = Boolean(template);
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState(template?.title ?? "");
  const [buyerName, setBuyerName] = useState(template?.buyer_name ?? "");
  const [recipientName, setRecipientName] = useState(template?.recipient_name ?? "");
  const [loginId, setLoginId] = useState(template?.login_id ?? "");
  const [phone, setPhone] = useState(template?.phone ?? "");
  const [address, setAddress] = useState(template?.address ?? "");
  const [bankAccountNumber, setBankAccountNumber] = useState(template?.bank_account_number ?? "");
  const [accountHolder, setAccountHolder] = useState(template?.account_holder ?? "");

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  // 입력 중인 값을 그대로 가상의 템플릿으로 만들어 카카오톡 한 줄 결과를 즉시 보여줍니다.
  const previewTemplate: PurchaseTemplateRow = {
    id: template?.id ?? "preview",
    user_id: template?.user_id ?? "",
    title: title.trim() || "새 템플릿",
    buyer_name: buyerName.trim() || null,
    recipient_name: recipientName.trim() || null,
    login_id: loginId.trim() || null,
    phone: phone.trim() || null,
    address: address.trim() || null,
    bank_account_number: bankAccountNumber.trim() || null,
    account_holder: accountHolder.trim() || null,
    created_at: template?.created_at ?? "",
    updated_at: template?.updated_at ?? "",
  };
  const previewLine = buildKakaoPasteLine(previewTemplate, "주문번호", "구매금액");

  const handleCopyPreview = async () => {
    try {
      await copyTextToClipboard(previewLine);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1800);
    } catch {
      setErrorMessage("미리보기 복사에 실패했습니다. 브라우저의 클립보드 권한을 확인해 주세요.");
    }
  };

  const handleSubmit = async () => {
    const titleValue = title.trim();
    if (!titleValue) {
      setErrorMessage("제목을 입력해 주세요.");
      return;
    }

    setErrorMessage("");
    setIsSaving(true);

    const fields = {
      title: titleValue,
      buyer_name: buyerName.trim() || null,
      recipient_name: recipientName.trim() || null,
      login_id: loginId.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      bank_account_number: bankAccountNumber.trim() || null,
      account_holder: accountHolder.trim() || null,
    };

    try {
      if (isEdit && template) {
        const payload: Update = fields;
        const { error } = await supabase.from("purchase_info_templates").update(payload).eq("id", template.id);
        if (error) {
          setErrorMessage(error.message);
          return;
        }
      } else {
        const payload: Insert = fields;
        const { error } = await supabase.from("purchase_info_templates").insert(payload);
        if (error) {
          setErrorMessage(error.message);
          return;
        }
      }
      router.replace("/settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative flex flex-col gap-5 pb-8">
      {errorMessage ? (
        <p className="text-destructive rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          {errorMessage}
        </p>
      ) : null}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.8fr)]">
        <Card className="min-w-0 shadow-sm ring-border/60" size="sm">
          <CardHeader className="border-border/60 border-b pb-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25">
                <ClipboardList className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-base">{isEdit ? "구매 정보 템플릿 수정" : "구매 정보 템플릿"}</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  {isEdit
                    ? "값을 바꾼 뒤 저장하면 설정 목록에 반영됩니다."
                    : "카톡에 붙여넣을 때 쓸 값을 저장해 두면 됩니다. 제목만 필수입니다."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-border/50">
            <FormRow label="제목" required hint="목록에서 이 이름으로만 보입니다">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-10 rounded-xl md:text-sm"
                autoComplete="off"
                placeholder="예: 단골 A방"
              />
            </FormRow>
            <FormRow label="구매자">
              <Input
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                className="h-10 rounded-xl md:text-sm"
                autoComplete="name"
              />
            </FormRow>
            <FormRow label="수취인">
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="h-10 rounded-xl md:text-sm"
                autoComplete="off"
              />
            </FormRow>
            <FormRow label="아이디">
              <Input
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className="h-10 rounded-xl md:text-sm"
                autoComplete="username"
              />
            </FormRow>
            <FormRow label="연락처">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-10 rounded-xl md:text-sm"
                autoComplete="tel"
                inputMode="tel"
              />
            </FormRow>
            <FormRow label="주소">
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={textareaClass}
                autoComplete="street-address"
              />
            </FormRow>
            <FormRow label="은행계좌번호">
              <Input
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                className="h-10 rounded-xl md:text-sm"
                autoComplete="off"
                inputMode="numeric"
              />
            </FormRow>
            <FormRow label="예금주">
              <Input
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                className="h-10 rounded-xl md:text-sm"
                autoComplete="off"
              />
            </FormRow>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit min-w-0 shadow-sm ring-border/60 lg:sticky lg:top-5" size="sm">
          <CardHeader className="border-border/60 border-b pb-4">
            <CardTitle className="text-base">카카오톡 미리보기</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              입력한 값이 주문번호·금액과 함께 한 줄로 붙여넣어집니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div className="rounded-xl border bg-muted/30 p-3">
              <p className="break-all whitespace-pre-wrap text-sm leading-6">{previewLine}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleCopyPreview()}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-muted/60"
            >
              {isCopied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {isCopied ? "복사했습니다" : "미리보기 복사"}
            </button>
            <p className="text-xs leading-relaxed text-muted-foreground">
              비어 있는 값은 구분자 사이를 비워 두며, 주소 줄바꿈은 한 줄로 정리됩니다.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void handleSubmit()}
          className={cn(buttonVariants({ size: "default" }), "w-full sm:w-auto")}
        >
          {isSaving ? "저장 중…" : "저장"}
        </button>
      </div>
    </div>
  );
}
