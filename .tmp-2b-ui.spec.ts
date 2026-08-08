import { expect, test, type Page, type Route } from "/Users/2sssg/.npm/_npx/eb7983f9b02fb67f/node_modules/@playwright/test/index.js";

test.use({ launchOptions: { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" } });

const userId = "11111111-1111-4111-8111-111111111111";
const now = new Date().toISOString();
const user = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "ui-check@example.com",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { name: "UI 점검" },
  created_at: now,
};
const token = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: userId, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.mock`;
const session = { access_token: token, refresh_token: "mock-refresh", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user };

const platform = { id: "21111111-1111-4111-8111-111111111111", name: "네이버", color: "#16a34a", user_id: null, is_active: true };
const method = { id: "31111111-1111-4111-8111-111111111111", name: "카드", color: "#2563eb", user_id: null, is_active: true };
const account = { id: "41111111-1111-4111-8111-111111111111", label: "운영 계정", color: "#64748b", user_id: userId };
const template = {
  id: "51111111-1111-4111-8111-111111111111",
  user_id: userId,
  title: "기본 배송지",
  buyer_name: "구매자",
  recipient_name: "수취인",
  login_id: null,
  phone: null,
  address: null,
  bank_account_number: null,
  account_holder: null,
  created_at: now,
  updated_at: now,
};

function order(id: number, processed = false, deleted = false) {
  return {
    id: `61111111-1111-4111-8111-${String(id).padStart(12, "0")}`,
    user_id: userId,
    title: `공구방 ${id}`,
    product_name: `가독성 점검 상품 ${id}`,
    is_processed: processed,
    purchase_date: `2026-08-${String(8 - (id % 3)).padStart(2, "0")}`,
    deposit_date: processed ? "2026-08-08" : null,
    purchase_price_krw: 10000 + id * 1000,
    deposit_amount_krw: processed ? 12000 + id * 1000 : null,
    profit_krw: processed ? 2000 : null,
    is_item_delivered: id % 2 === 0,
    deposit_memo: processed ? "입금 확인" : null,
    notes: "모바일과 데스크톱 레이아웃 확인",
    product_url: null,
    scheduled_purchase_at: null,
    order_number: `ORDER-${id}`,
    screenshot_storage_path: null,
    order_status: null,
    review_photo_count: null,
    review_char_count: null,
    ai_review: null,
    ai_review_user_prompt: null,
    purchase_info_template_id: template.id,
    platform_id: platform.id,
    payment_method_id: method.id,
    buyer_account_id: account.id,
    created_at: now,
    updated_at: now,
    deleted_at: deleted ? now : null,
    platforms: platform,
    payment_methods: method,
    buyer_accounts: account,
    purchase_info_templates: template,
  };
}

const pendingOrders = Array.from({ length: 12 }, (_, index) => order(index + 1));
const completedOrders = [order(21, true), order(22, true)];

function json(route: Route, data: unknown, headers: Record<string, string> = {}) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "content-range": `0-${Array.isArray(data) ? Math.max(0, data.length - 1) : 0}/${Array.isArray(data) ? data.length : 1}`, ...headers },
    body: JSON.stringify(data),
  });
}

async function mockSupabase(page: Page) {
  // 실제 사용자 데이터에 손대지 않고 UI 흐름만 확인하기 위해 브라우저 요청을 고정 응답으로 대체합니다.
  await page.addInitScript(({ storedSession }) => {
    localStorage.setItem("sb-xhjjoxzwpgqlodflaiix-auth-token", JSON.stringify(storedSession));
  }, { storedSession: session });

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith("/auth/v1/user")) return json(route, user);
    if (url.pathname.includes("/auth/v1/token")) return json(route, session);
    if (!url.pathname.includes("/rest/v1/")) return route.continue();

    const table = url.pathname.split("/rest/v1/")[1];
    if (request.method() === "HEAD") {
      const count = table === "orders" && url.search.includes("not.is.null") ? 1 : table === "orders" ? 14 : 0;
      return route.fulfill({ status: 200, headers: { "content-range": `0-0/${count}` }, body: "" });
    }

    let data: unknown = [];
    if (table === "orders") {
      if (url.search.includes("not.is.null")) data = [order(99, false, true)];
      else if (url.search.includes("is_processed=eq.true")) data = completedOrders;
      else if (url.search.includes("is_processed=eq.false")) data = pendingOrders;
      else data = [...pendingOrders, ...completedOrders];
    } else if (table === "platforms") data = [platform];
    else if (table === "payment_methods") data = [method];
    else if (table === "buyer_accounts") data = [account];
    else if (table === "purchase_info_templates") data = [template];
    else if (table === "saved_order_views" || table === "user_item_settings") data = [];
    else if (table === "user_preferences") data = {
      user_id: userId,
      default_platform_id: null,
      default_payment_method_id: null,
      default_buyer_account_id: null,
      default_purchase_info_template_id: null,
      recent_platform_id: null,
      recent_payment_method_id: null,
      recent_buyer_account_id: null,
      recent_purchase_info_template_id: null,
      order_save_action: "ledger",
      auto_advance_recommendations: true,
      ledger_density: "compact",
      created_at: now,
      updated_at: now,
    };
    else if (table === "users") data = { name: "UI 점검", email: user.email };
    else if (table === "user_ai_review_profiles") data = { user_id: userId, gender: null, age_range: null, region: null, occupation: null, extra_context: null, created_at: now, updated_at: now };
    else if (table === "platform_accounts") data = [];
    else if (table === "crawl_orders") {
      data = url.search.includes("in.%281%2C99%29") || url.search.includes("in.(1%2C99)")
        ? [
            { id: "crawl-hidden", user_id: userId, crawl_order_status: 99, product_name: "숨긴 추천 주문", purchase_date: "2026-08-08", updated_at: now, created_at: now },
            { id: "crawl-done", user_id: userId, crawl_order_status: 1, product_name: "처리한 추천 주문", purchase_date: "2026-08-07", updated_at: now, created_at: now },
          ]
        : [{ id: "crawl-active", user_id: userId, crawl_order_status: 0, product_name: "대기 추천 주문", purchase_date: "2026-08-08", updated_at: now, created_at: now }];
    } else if (table === "bank_account") data = [{ id: 1, bank_account_name: "운영 계좌", bank: "테스트은행", bank_account_number: "000-000" }];
    else if (table === "bank_account_deposit") {
      data = url.search.includes("in.%281%2C99%29") || url.search.includes("in.(1%2C99)")
        ? [{ id: 1, bank_account_id: 1, date: "2026-08-08", time: "12:00:00", counterparty: "숨긴 입금", amount: 12000, bank_account_deposit_status: 99, bank_account: { bank_account_name: "운영 계좌", bank: "테스트은행", bank_account_number: "000-000" } }]
        : [];
    }

    const wantsObject = request.headers()["accept"]?.includes("application/vnd.pgrst.object");
    if (wantsObject && Array.isArray(data)) data = data[0] ?? null;
    return json(route, data);
  });
}

async function expectNoPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

test("데스크톱 주문 선택과 일괄 변경 확인 흐름", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockSupabase(page);
  await page.goto("http://127.0.0.1:3001/");
  await expect(page.getByRole("heading", { name: "구매 장부" })).toBeVisible();
  await page.getByRole("button", { name: "주문 선택" }).click();
  await page.getByRole("button", { name: /화면 12건 선택/ }).click();
  await expect(page.getByText("12건", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "일괄 변경" }).click();
  await expect(page.getByRole("heading", { name: "선택 주문 일괄 변경" })).toBeVisible();
  await expect(page.getByText("변경 전 → 변경 후")).toBeVisible();
  await expectNoPageOverflow(page);
});

test("모바일 선택 모드에서 스와이프 대신 체크박스 제공", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSupabase(page);
  await page.goto("http://127.0.0.1:3001/");
  await page.getByRole("button", { name: "주문 선택" }).click();
  const checkbox = page.getByRole("checkbox", { name: /가독성 점검 상품 1 선택/ });
  await expect(checkbox).toBeVisible();
  await checkbox.check();
  await expect(page.getByText("1건", { exact: true }).last()).toBeVisible();
  await expectNoPageOverflow(page);
});

test("설정 휴지통과 자동추천 복구 탭", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockSupabase(page);
  await page.goto("http://127.0.0.1:3001/settings?view=trash");
  await expect(page.getByRole("heading", { name: "주문 휴지통" })).toBeVisible();
  await expect(page.getByText("가독성 점검 상품 99")).toBeVisible();
  await expect(page.getByRole("button", { name: "복원" })).toBeVisible();

  await page.goto("http://127.0.0.1:3001/menu-4");
  await page.getByRole("button", { name: /최근 처리·숨김/ }).click();
  await expect(page.getByRole("heading", { name: "최근 처리·숨김 내역" })).toBeVisible();
  await expect(page.getByText("숨긴 추천 주문")).toBeVisible();
  await expect(page.getByRole("button", { name: "추천 대기열로 복원" })).toBeVisible();
  await expectNoPageOverflow(page);
});
