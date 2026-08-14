import type { SupabaseClient } from "@supabase/supabase-js";

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

async function readHttpErrorMessage(res: Response): Promise<string> {
  let msg = res.statusText;
  try {
    const j = (await res.clone().json()) as { error?: string; message?: string };
    if (j.error) msg = j.error;
    else if (j.message) msg = j.message;
  } catch {
    try {
      msg = (await res.text()).slice(0, 2000);
    } catch {
      /* ignore */
    }
  }
  return msg || `HTTP ${res.status}`;
}

async function readNdjsonStream(
  response: Response,
  onDelta: (chunk: string) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!response.body) return { ok: false, error: "Edge Function 응답 스트림이 없습니다." };

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamDone = false;

  const processLine = (line: string): { ok: true } | { ok: false; error: string } => {
    const t = line.trim();
    if (!t) return { ok: true };

    let row: { d?: string; done?: boolean; error?: string };
    try {
      row = JSON.parse(t) as { d?: string; done?: boolean; error?: string };
    } catch {
      return { ok: true };
    }
    if (row.error) return { ok: false, error: row.error };
    if (typeof row.d === "string" && row.d) onDelta(row.d);
    if (row.done === true) streamDone = true;
    return { ok: true };
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r/g, "");

    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      const result = processLine(line);
      if (!result.ok) {
        await reader.cancel().catch(() => undefined);
        return result;
      }
    }
  }

  const trailing = processLine(buffer);
  if (!trailing.ok) return trailing;
  if (!streamDone) return { ok: false, error: "AI 리뷰 스트림이 정상적으로 끝나지 않았습니다." };
  return { ok: true };
}

/**
 * Edge Function `generate-ai-review`를 직접 호출해 NDJSON을 도착 즉시 읽습니다.
 * Supabase client에서 확인한 세션 토큰과 public anon key만 브라우저 요청 헤더에 사용합니다.
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (!supabaseUrl || !anonKey) {
      return { ok: false, error: "Supabase 환경변수가 설정되지 않았습니다." };
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/generate-ai-review`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: anonKey,
        "Content-Type": "application/json",
        "x-client-info": "review-manager-ai-review",
      },
      body: JSON.stringify({
        order_id: options.orderId,
        user_prompt: options.userPrompt,
        review_char_count: options.reviewCharCount ?? null,
      }),
      cache: "no-store",
      signal: options.signal,
    });

    if (!response.ok) return { ok: false, error: await readHttpErrorMessage(response) };
    return await readNdjsonStream(response, options.onDelta);
  } catch (e) {
    if (options.signal?.aborted || (e instanceof DOMException && e.name === "AbortError")) {
      return { ok: false, error: "AI 리뷰 생성이 취소되었습니다." };
    }
    return { ok: false, error: explainFetchFailure(e) };
  }
}
