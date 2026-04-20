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

/** 무료 티에서 RPM 여유가 상대적으로 큰 편인 Flash-Lite를 기본값으로 둡니다. */
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";

/**
 * REST 경로는 `.../v1beta/models/{모델id}:streamGenerateContent` 형태라 id만 필요합니다.
 * `models/` 접두어는 URL에 이미 있으므로 제거합니다.
 * Developer API에서 1.5 계열은 404가 나는 경우가 많아 무료 티에 맞는 2.5 Lite로 돌립니다.
 */
function normalizeGeminiModelId(raw: string): string {
  let s = raw.trim();
  if (!s) return DEFAULT_GEMINI_MODEL;
  if (s.startsWith("models/")) s = s.slice("models/".length).trim();
  if (!s) return DEFAULT_GEMINI_MODEL;
  if (/^gemini-1\.5-flash/i.test(s) || s === "gemini-1.5-flash-latest") {
    return DEFAULT_GEMINI_MODEL;
  }
  if (/^gemini-1\.5-pro/i.test(s)) return DEFAULT_GEMINI_MODEL;
  return s;
}

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

/** async generator 대신 일반 async 함수(Edge 번들에서 Illegal return 이슈 회피) */
async function pumpGeminiSseChunks(
  apiKey: string,
  model: string,
  prompt: string,
  onChunk: (piece: string) => Promise<void>,
): Promise<void> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent` +
    `?alt=sse&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `Gemini HTTP ${res.status}`);
  }
  if (!res.body) throw new Error("Gemini 응답 본문이 없습니다.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let obj: Record<string, unknown>;
      try {
        obj = JSON.parse(payload) as Record<string, unknown>;
      } catch {
        continue;
      }
      const err = obj.error as { message?: string } | undefined;
      if (err?.message) throw new Error(err.message);
      const candidates = obj.candidates as Array<{
        content?: { parts?: Array<{ text?: string }> };
      }> | undefined;
      const parts = candidates?.[0]?.content?.parts;
      if (!parts?.length) continue;
      for (const p of parts) {
        if (typeof p.text === "string" && p.text.length > 0) await onChunk(p.text);
      }
    }
  }
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
  const geminiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  const geminiModel = normalizeGeminiModelId(Deno.env.get("GEMINI_MODEL") ?? DEFAULT_GEMINI_MODEL);

  if (!geminiKey) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY 가 설정되지 않았습니다." }), {
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
        await pumpGeminiSseChunks(geminiKey, geminiModel, prompt, async (piece) => {
          accumulated += piece;
          try {
            await writer.write(encoder.encode(`${JSON.stringify({ d: piece })}\n`));
          } catch {
            /* 클라이언트가 스트림을 닫은 경우 */
          }
        });
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
    },
  });
});
