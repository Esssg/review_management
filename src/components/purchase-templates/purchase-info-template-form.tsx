"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClipboardList } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PurchaseTemplateRow } from "@/lib/kakao-purchase-paste";
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

      <Card className="shadow-sm ring-border/60" size="sm">
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
