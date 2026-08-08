# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: .tmp-2b-ui.spec.ts >> 모바일 선택 모드에서 스와이프 대신 체크박스 제공
- Location: .tmp-2b-ui.spec.ts:174:5

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:3001/
Call log:
  - navigating to "http://127.0.0.1:3001/", waiting until "load"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e6]:
    - heading "사이트에 연결할 수 없음" [level=1] [ref=e7]
    - paragraph [ref=e8]:
      - strong [ref=e9]: 127.0.0.1
      - text: 에서 연결을 거부했습니다.
    - generic [ref=e10]:
      - paragraph [ref=e11]: 다음 방법을 시도해 보세요.
      - list [ref=e12]:
        - listitem [ref=e13]: 연결 확인
        - listitem [ref=e14]:
          - link "프록시 및 방화벽 확인" [ref=e15] [cursor=pointer]:
            - /url: "#buttons"
    - generic [ref=e16]: ERR_CONNECTION_REFUSED
  - generic [ref=e17]:
    - button "새로고침" [ref=e19] [cursor=pointer]
    - button "세부정보" [ref=e20] [cursor=pointer]
```

# Test source

```ts
  77  | 
  78  | function json(route: Route, data: unknown, headers: Record<string, string> = {}) {
  79  |   return route.fulfill({
  80  |     status: 200,
  81  |     contentType: "application/json",
  82  |     headers: { "content-range": `0-${Array.isArray(data) ? Math.max(0, data.length - 1) : 0}/${Array.isArray(data) ? data.length : 1}`, ...headers },
  83  |     body: JSON.stringify(data),
  84  |   });
  85  | }
  86  | 
  87  | async function mockSupabase(page: Page) {
  88  |   // 실제 사용자 데이터에 손대지 않고 UI 흐름만 확인하기 위해 브라우저 요청을 고정 응답으로 대체합니다.
  89  |   await page.addInitScript(({ storedSession }) => {
  90  |     localStorage.setItem("sb-xhjjoxzwpgqlodflaiix-auth-token", JSON.stringify(storedSession));
  91  |   }, { storedSession: session });
  92  | 
  93  |   await page.route("**/*", async (route) => {
  94  |     const request = route.request();
  95  |     const url = new URL(request.url());
  96  |     if (url.pathname.endsWith("/auth/v1/user")) return json(route, user);
  97  |     if (url.pathname.includes("/auth/v1/token")) return json(route, session);
  98  |     if (!url.pathname.includes("/rest/v1/")) return route.continue();
  99  | 
  100 |     const table = url.pathname.split("/rest/v1/")[1];
  101 |     if (request.method() === "HEAD") {
  102 |       const count = table === "orders" && url.search.includes("not.is.null") ? 1 : table === "orders" ? 14 : 0;
  103 |       return route.fulfill({ status: 200, headers: { "content-range": `0-0/${count}` }, body: "" });
  104 |     }
  105 | 
  106 |     let data: unknown = [];
  107 |     if (table === "orders") {
  108 |       if (url.search.includes("not.is.null")) data = [order(99, false, true)];
  109 |       else if (url.search.includes("is_processed=eq.true")) data = completedOrders;
  110 |       else if (url.search.includes("is_processed=eq.false")) data = pendingOrders;
  111 |       else data = [...pendingOrders, ...completedOrders];
  112 |     } else if (table === "platforms") data = [platform];
  113 |     else if (table === "payment_methods") data = [method];
  114 |     else if (table === "buyer_accounts") data = [account];
  115 |     else if (table === "purchase_info_templates") data = [template];
  116 |     else if (table === "saved_order_views" || table === "user_item_settings") data = [];
  117 |     else if (table === "user_preferences") data = {
  118 |       user_id: userId,
  119 |       default_platform_id: null,
  120 |       default_payment_method_id: null,
  121 |       default_buyer_account_id: null,
  122 |       default_purchase_info_template_id: null,
  123 |       recent_platform_id: null,
  124 |       recent_payment_method_id: null,
  125 |       recent_buyer_account_id: null,
  126 |       recent_purchase_info_template_id: null,
  127 |       order_save_action: "ledger",
  128 |       auto_advance_recommendations: true,
  129 |       ledger_density: "compact",
  130 |       created_at: now,
  131 |       updated_at: now,
  132 |     };
  133 |     else if (table === "users") data = { name: "UI 점검", email: user.email };
  134 |     else if (table === "user_ai_review_profiles") data = { user_id: userId, gender: null, age_range: null, region: null, occupation: null, extra_context: null, created_at: now, updated_at: now };
  135 |     else if (table === "platform_accounts") data = [];
  136 |     else if (table === "crawl_orders") {
  137 |       data = url.search.includes("in.%281%2C99%29") || url.search.includes("in.(1%2C99)")
  138 |         ? [
  139 |             { id: "crawl-hidden", user_id: userId, crawl_order_status: 99, product_name: "숨긴 추천 주문", purchase_date: "2026-08-08", updated_at: now, created_at: now },
  140 |             { id: "crawl-done", user_id: userId, crawl_order_status: 1, product_name: "처리한 추천 주문", purchase_date: "2026-08-07", updated_at: now, created_at: now },
  141 |           ]
  142 |         : [{ id: "crawl-active", user_id: userId, crawl_order_status: 0, product_name: "대기 추천 주문", purchase_date: "2026-08-08", updated_at: now, created_at: now }];
  143 |     } else if (table === "bank_account") data = [{ id: 1, bank_account_name: "운영 계좌", bank: "테스트은행", bank_account_number: "000-000" }];
  144 |     else if (table === "bank_account_deposit") {
  145 |       data = url.search.includes("in.%281%2C99%29") || url.search.includes("in.(1%2C99)")
  146 |         ? [{ id: 1, bank_account_id: 1, date: "2026-08-08", time: "12:00:00", counterparty: "숨긴 입금", amount: 12000, bank_account_deposit_status: 99, bank_account: { bank_account_name: "운영 계좌", bank: "테스트은행", bank_account_number: "000-000" } }]
  147 |         : [];
  148 |     }
  149 | 
  150 |     const wantsObject = request.headers()["accept"]?.includes("application/vnd.pgrst.object");
  151 |     if (wantsObject && Array.isArray(data)) data = data[0] ?? null;
  152 |     return json(route, data);
  153 |   });
  154 | }
  155 | 
  156 | async function expectNoPageOverflow(page: Page) {
  157 |   expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  158 | }
  159 | 
  160 | test("데스크톱 주문 선택과 일괄 변경 확인 흐름", async ({ page }) => {
  161 |   await page.setViewportSize({ width: 1440, height: 1000 });
  162 |   await mockSupabase(page);
  163 |   await page.goto("http://127.0.0.1:3001/");
  164 |   await expect(page.getByRole("heading", { name: "구매 장부" })).toBeVisible();
  165 |   await page.getByRole("button", { name: "주문 선택" }).click();
  166 |   await page.getByRole("button", { name: /화면 12건 선택/ }).click();
  167 |   await expect(page.getByText("12건", { exact: true }).last()).toBeVisible();
  168 |   await page.getByRole("button", { name: "일괄 변경" }).click();
  169 |   await expect(page.getByRole("heading", { name: "선택 주문 일괄 변경" })).toBeVisible();
  170 |   await expect(page.getByText("변경 전 → 변경 후")).toBeVisible();
  171 |   await expectNoPageOverflow(page);
  172 | });
  173 | 
  174 | test("모바일 선택 모드에서 스와이프 대신 체크박스 제공", async ({ page }) => {
  175 |   await page.setViewportSize({ width: 390, height: 844 });
  176 |   await mockSupabase(page);
> 177 |   await page.goto("http://127.0.0.1:3001/");
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:3001/
  178 |   await page.getByRole("button", { name: "주문 선택" }).click();
  179 |   const checkbox = page.getByRole("checkbox", { name: /가독성 점검 상품 1 선택/ });
  180 |   await expect(checkbox).toBeVisible();
  181 |   await checkbox.check();
  182 |   await expect(page.getByText("1건", { exact: true }).last()).toBeVisible();
  183 |   await expectNoPageOverflow(page);
  184 | });
  185 | 
  186 | test("설정 휴지통과 자동추천 복구 탭", async ({ page }) => {
  187 |   await page.setViewportSize({ width: 1280, height: 900 });
  188 |   await mockSupabase(page);
  189 |   await page.goto("http://127.0.0.1:3001/settings?view=trash");
  190 |   await expect(page.getByRole("heading", { name: "주문 휴지통" })).toBeVisible();
  191 |   await expect(page.getByText("가독성 점검 상품 99")).toBeVisible();
  192 |   await expect(page.getByRole("button", { name: "복원" })).toBeVisible();
  193 | 
  194 |   await page.goto("http://127.0.0.1:3001/menu-4");
  195 |   await page.getByRole("button", { name: /최근 처리·숨김/ }).click();
  196 |   await expect(page.getByRole("heading", { name: "최근 처리·숨김 내역" })).toBeVisible();
  197 |   await expect(page.getByText("숨긴 추천 주문")).toBeVisible();
  198 |   await expect(page.getByRole("button", { name: "추천 대기열로 복원" })).toBeVisible();
  199 |   await expectNoPageOverflow(page);
  200 | });
  201 | 
```