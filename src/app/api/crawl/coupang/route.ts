// 자동추천 화면에서 부르는 크롤링 트리거의 서버 프록시.
// HTTPS 페이지에서 평문 HTTP 외부 서버를 직접 호출하면 Mixed Content로 차단되므로,
// 같은 도메인의 서버 라우트를 거쳐 외부 크롤링 서버에 요청을 던집니다.
// 클라이언트가 실패를 구분할 수 있도록 외부 호출의 HTTP 상태를 그대로 전달합니다.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRAWL_TARGET = "http://175.125.243.56:8003/crawl/coupang";

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const platformAccountId = incoming.searchParams.get("platform_account_id")?.trim() ?? "";
  const maxPages = incoming.searchParams.get("max_pages")?.trim() || "2";

  if (!platformAccountId) {
    return new Response("platform_account_id is required", { status: 400 });
  }

  const target = new URL(CRAWL_TARGET);
  target.searchParams.set("platform_account_id", platformAccountId);
  target.searchParams.set("max_pages", maxPages);

  try {
    // 외부 크롤링 서버는 작업을 시작만 시키므로 응답 본문은 읽지 않습니다.
    // 함수가 일찍 종료돼 요청이 끊기지 않도록 fetch가 끝날 때까지는 기다립니다.
    const response = await fetch(target.toString(), { method: "GET", cache: "no-store" });
    return new Response(null, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        "X-Crawl-Upstream-Status": String(response.status),
        "X-Crawl-Upstream-Status-Text": response.statusText,
      },
    });
  } catch {
    // 외부 서버가 닿지 않으면 클라이언트가 실패 메시지를 띄울 수 있게 502로 알립니다.
    return new Response(null, {
      status: 502,
      statusText: "Bad Gateway",
      headers: {
        "X-Crawl-Upstream-Status": "network-error",
        "X-Crawl-Upstream-Status-Text": "Bad Gateway",
      },
    });
  }
}
