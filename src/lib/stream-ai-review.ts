import {
  type SupabaseClient,
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export type StreamAiReviewOptions = {
  orderId: string;
  userPrompt: string;
  /** 주문 상세 화면에 입력된 리뷰 글자 수(미입력·0이면 null). DB 값이 아닙니다. */
  reviewCharCount?: number | null;
  onDelta: (chunk: string) => void;
  /** 전달하지 않으면 화면 이탈 후에도 요청이 중단되지 않습니다. */
  signal?: AbortSignal;
};

function explainFetchFailure(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const isNetwork =
    msg === "Failed to fetch" ||
    msg === "Load failed" ||
    msg === "NetworkError when attempting to fetch resource." ||
    (err instanceof TypeError && /fetch|network|load failed/i.test(msg));
  if (isNetwork) {
    return [
      "Edge Function 서버에 연결하지 못했습니다(Failed to fetch).",
      "① Supabase에 `generate-ai-review` 함수를 배포했는지",
      "② 대시보드 Edge Functions → 로그에 오류가 없는지",
      "③ PC/폰 방화벽·VPN·광고 차단 앱을 잠시 끄고 다시 시도",
      "④ 개발자도구 Network 탭에서 `generate-ai-review` 요청이 (failed)인지 확인",
    ].join(" ");
  }
  return msg;
}

function applyNdjsonText(text: string, onDelta: (chunk: string) => void): { ok: true } | { ok: false; error: string } {
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    let row: { d?: string; done?: boolean; error?: string };
    try {
      row = JSON.parse(t) as { d?: string; done?: boolean; error?: string };
    } catch {
      continue;
    }
    if (row.error) return { ok: false, error: row.error };
    if (typeof row.d === "string" && row.d) onDelta(row.d);
  }
  return { ok: true };
}

async function readHttpErrorMessage(error: FunctionsHttpError): Promise<string> {
  const res = error.context as Response;
  let msg = res.statusText;
  try {
    const j = (await res.clone().json()) as { error?: string; message?: string };
    if (j.error) msg = j.error;
    else if (j.message) msg = j.message;
  } catch {
    try {
      msg = await res.text();
    } catch {
      /* ignore */
    }
  }
  return msg || `HTTP ${res.status}`;
}

/**
 * Edge Function `generate-ai-review` 호출.
 * `supabase.functions.invoke` + 내부 fetch 경로를 사용해 인증·URL을 DB와 동일하게 맞춥니다.
 * (invoke는 응답이 끝난 뒤 본문을 한 번에 받으므로, NDJSON 델타는 순서대로 onDelta에 전달합니다.)
 */
export async function streamAiReviewFromEdge(
  supabase: SupabaseClient<Database>,
  options: StreamAiReviewOptions,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { ok: false, error: "로그인이 필요합니다." };
    }

    const { data, error } = await supabase.functions.invoke<string>("generate-ai-review", {
      body: {
        order_id: options.orderId,
        user_prompt: options.userPrompt,
        review_char_count: options.reviewCharCount ?? null,
      },
      signal: options.signal,
    });

    if (error) {
      if (error instanceof FunctionsHttpError) {
        const msg = await readHttpErrorMessage(error);
        return { ok: false, error: msg };
      }
      if (error instanceof FunctionsRelayError) {
        return { ok: false, error: error.message || "Edge 릴레이 오류가 발생했습니다." };
      }
      if (error instanceof FunctionsFetchError) {
        return { ok: false, error: explainFetchFailure(error.context) };
      }
      return { ok: false, error: explainFetchFailure(error) };
    }

    if (typeof data !== "string") {
      return { ok: false, error: "Edge Function 응답 형식이 올바르지 않습니다." };
    }

    const parsed = applyNdjsonText(data, options.onDelta);
    if (!parsed.ok) return parsed;

    return { ok: true };
  } catch (e) {
    return { ok: false, error: explainFetchFailure(e) };
  }
}
