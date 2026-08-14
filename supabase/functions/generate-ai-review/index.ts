import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function scheduleBackground(promise: Promise<unknown>) {
  const er = (globalThis as { EdgeRuntime?: { waitUntil: (x: Promise<unknown>) => void } }).EdgeRuntime;
  if (er?.waitUntil) er.waitUntil(promise);
  else void promise;
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Max-Age": "86400",
};

const OPENAI_MODEL = "gpt-5.6-luna";
const OPENAI_REASONING_EFFORT = "medium";

function buildPrompt(
  productName: string,
  profileLine: string,
  userExtra: string,
  reviewCharCount: number | null,
) {
  const profile = profileLine.trim() || "별도로 저장된 프로필 없음";
  const extra = userExtra.trim() || "(추가 입력 없음)";
  const n =
    reviewCharCount != null && Number.isFinite(reviewCharCount) && reviewCharCount > 0
      ? Math.floor(Number(reviewCharCount))
      : null;
  const maxLen = n != null ? n + 50 : null;
  const lengthHint =
    n != null && maxLen != null
      ? [
          ` 리뷰 본문 길이는 공백 포함 기준으로 약 ${n}자 이상 ${maxLen}자 이하로 맞춰서 작성해줘.`,
          `【필수·엄수】최종 리뷰 본문의 글자 수(공백 포함)는 절대 ${maxLen}자를 넘지 마라.`,
          `어떤 경우에도 ${maxLen}자 초과는 금지다. ${maxLen}자를 맞추기 어렵다면 내용을 줄여서라도 반드시 ${maxLen}자 이하로 끝내라.`,
        ].join("")
      : "";
  return (
    `나는 ${productName}에 대해서 리뷰를 쓸거야 나의 정보는 ${profile}이고 \n` +
    `${extra} 이렇게 리뷰를 쓸거야 최대한 직접 사용해본것 처럼 리뷰를 작성해줘 중간중간 약간의 오타를 넣어도 좋아 그리고 이모지나 특수문자 이런것도 금지야` +
    lengthHint
  );
}

function profileToLine(row: {
  gender: string | null;
  age_range: string | null;
  region: string | null;
  occupation: string | null;
  extra_context: string | null;
} | null) {
  if (!row) return "";
  const parts: string[] = [];
  if (row.gender?.trim()) parts.push(`성별: ${row.gender.trim()}`);
  if (row.age_range?.trim()) parts.push(`나이대: ${row.age_range.trim()}`);
  if (row.region?.trim()) parts.push(`거주지역: ${row.region.trim()}`);
  if (row.occupation?.trim()) parts.push(`직업/환경: ${row.occupation.trim()}`);
  if (row.extra_context?.trim()) parts.push(`기타: ${row.extra_context.trim()}`);
  return parts.join(", ");
}

type OpenAiStreamEvent = {
  type?: string;
  delta?: string;
  error?: { message?: string } | null;
  response?: {
    error?: { message?: string } | null;
    incomplete_details?: { reason?: string } | null;
  } | null;
};

function getOpenAiStreamError(event: OpenAiStreamEvent): string | null {
  if (event.error?.message) return event.error.message;
  if (event.response?.error?.message) return event.response.error.message;
  if (event.type === "response.incomplete") {
    return event.response?.incomplete_details?.reason
      ? `OpenAI 응답이 완료되지 않았습니다: ${event.response.incomplete_details.reason}`
      : "OpenAI 응답이 완료되지 않았습니다.";
  }
  if (event.type === "response.failed") return "OpenAI 리뷰 생성에 실패했습니다.";
  return null;
}

async function readOpenAiErrorMessage(response: Response): Promise<string> {
  const raw = await response.text();
  try {
    const body = JSON.parse(raw) as { error?: { message?: string } | string; message?: string };
    if (typeof body.error === "string" && body.error.trim()) return body.error.trim();
    if (body.error && typeof body.error.message === "string" && body.error.message.trim()) {
      return body.error.message.trim();
    }
    if (typeof body.message === "string" && body.message.trim()) return body.message.trim();
  } catch {
    /* JSON이 아닌 오류 본문은 원문을 아래에서 사용합니다. */
  }
  return raw.trim().slice(0, 2000) || `OpenAI HTTP ${response.status}`;
}

/** OpenAI SSE를 읽고 리뷰 텍스트 델타만 전달합니다. */
async function pumpOpenAiSseChunks(
  apiKey: string,
  prompt: string,
  onChunk: (piece: string) => Promise<void>,
): Promise<void> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      reasoning: { effort: OPENAI_REASONING_EFFORT },
      store: false,
      stream: true,
      input: prompt,
    }),
  });
  if (!response.ok) throw new Error(await readOpenAiErrorMessage(response));
  if (!response.body) throw new Error("OpenAI 응답 본문이 없습니다.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;

  const processEvent = async (rawEvent: string) => {
    const data = rawEvent
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n")
      .trim();
    if (!data || data === "[DONE]") return;

    let event: OpenAiStreamEvent;
    try {
      event = JSON.parse(data) as OpenAiStreamEvent;
    } catch {
      throw new Error("OpenAI 스트리밍 응답을 해석하지 못했습니다.");
    }

    const streamError = getOpenAiStreamError(event);
    if (streamError) throw new Error(streamError);

    if (event.type === "response.output_text.delta" && typeof event.delta === "string" && event.delta) {
      await onChunk(event.delta);
    }
    if (event.type === "response.completed") completed = true;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r/g, "");
    let separator: number;
    while ((separator = buffer.indexOf("\n\n")) >= 0) {
      const rawEvent = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      await processEvent(rawEvent);
    }
  }

  if (buffer.trim()) await processEvent(buffer);
  if (!completed) throw new Error("OpenAI 스트림이 완료 이벤트 없이 종료되었습니다.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const openAiKey = Deno.env.get("OPENAI_API_KEY") ?? "";

  if (!openAiKey) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY 가 설정되지 않았습니다." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "인증이 필요합니다." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { order_id?: string; user_prompt?: string; review_char_count?: number | null };
  try {
    body = (await req.json()) as { order_id?: string; user_prompt?: string; review_char_count?: number | null };
  } catch {
    return new Response(JSON.stringify({ error: "JSON 본문이 올바르지 않습니다." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const orderId = typeof body.order_id === "string" ? body.order_id.trim() : "";
  const userPrompt = typeof body.user_prompt === "string" ? body.user_prompt : "";
  const reviewCharFromClient = ((): number | null => {
    const v = body.review_char_count;
    if (v === null || v === undefined) return null;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.floor(v);
    if (typeof v === "string" && String(v).trim()) {
      const n = Number(String(v).trim());
      if (Number.isFinite(n) && n > 0) return Math.floor(n);
    }
    return null;
  })();
  if (!orderId) {
    return new Response(JSON.stringify({ error: "order_id 가 필요합니다." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, user_id, product_name")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !order || order.user_id !== user.id) {
    return new Response(JSON.stringify({ error: "주문을 찾을 수 없거나 권한이 없습니다." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: profile } = await supabase
    .from("user_ai_review_profiles")
    .select("gender, age_range, region, occupation, extra_context")
    .eq("user_id", user.id)
    .maybeSingle();

  const prompt = buildPrompt(
    order.product_name,
    profileToLine(profile),
    userPrompt,
    reviewCharFromClient,
  );

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  scheduleBackground(
    (async () => {
      let accumulated = "";
      try {
        await pumpOpenAiSseChunks(openAiKey, prompt, async (piece) => {
          accumulated += piece;
          try {
            await writer.write(encoder.encode(`${JSON.stringify({ d: piece })}\n`));
          } catch {
            /* 클라이언트가 스트림을 닫은 경우 */
          }
        });
        if (!accumulated.trim()) throw new Error("OpenAI 응답에 리뷰 내용이 없습니다.");
        try {
          await writer.write(encoder.encode(`${JSON.stringify({ done: true })}\n`));
        } catch {
          /* ignore */
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        try {
          await writer.write(encoder.encode(`${JSON.stringify({ error: msg })}\n`));
        } catch {
          /* ignore */
        }
      } finally {
        const text = accumulated.trim();
        if (text) {
          const { error } = await supabase
            .from("orders")
            .update({ ai_review: text })
            .eq("id", orderId)
            .eq("user_id", user.id);
          if (error) console.error("ai_review persist error", error.message);
        }
        try {
          await writer.close();
        } catch {
          /* ignore */
        }
      }
    })(),
  );

  return new Response(readable, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
});
