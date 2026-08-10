# React Best Practices 전체 검토 후속 계획

작성일: 2026-08-11

## 목적

현재 동작과 UI를 유지하면서 React Best Practices와 저장소 개발/UI 규칙에 맞지 않는 렌더링, 데이터 조회, 번들, 중복 책임을 단계적으로 개선한다.

## 변경 제약

- 기능 동작과 화면 구조·스타일을 유지한다.
- API contract, Supabase public 스키마, RLS, 데이터 의미를 변경하지 않는다.
- 브라우저 SWR 조회는 기존 화면 동작을 유지하고, 서버 초기 조회는 Supabase 쿠키 세션과 Next.js Proxy를 사용하는 범위에서 적용한다. 모든 화면을 한 번에 서버 fetch로 전환하지 않고 화면별로 검증한다.
- 기존의 병렬 조회, 지연 조회, 가상 스크롤, 추천 캐시처럼 의도적으로 적용된 최적화는 유지한다.
- 새 추상화는 반복 책임이나 렌더 경계를 실제로 줄이는 경우에만 도입한다.
- 각 단계마다 관련 테스트와 린트·빌드를 실행하고, UI 변경 가능성이 있는 단계는 모바일·데스크톱을 모두 확인한다.

## 현재 적용 상태

- 완료: `xlsx` 클릭 시점 로딩, 대시보드 차트 dynamic import, 장부 가상 범위 계산 축소, 크롤링 반응형 branch 단일 마운트, 중복 조회 병렬화, 크롤링 상태 polling 경량화
- 완료: 장부 카드 callback 안정화, AI stream 프레임 단위 반영, 설정 템플릿 사용량 N+1 제거, 완료처리 mutation 공통화, media query 공통 hook, passive scroll listener, 작은 파생 계산 정리
- 완료: 장부 URL 필터 snapshot은 값이 바뀐 state만 반영하고, master data의 숨김 ID membership은 `Set`으로 조회함
- 완료: 설정 화면의 템플릿 사용량 조회를 `purchase-templates` view 진입 시점으로 지연하고, 다른 설정 화면 초기 조회에서는 제외
- 완료: 전역 레이아웃의 온보딩 튜토리얼을 첫 렌더 직후 별도 dynamic chunk로 지연 로드하고 서버 렌더링에서 제외
- 완료: 크롤링 페이지의 입금 추천 로컬 render helper를 top-level 컴포넌트로 분리하고, 자동 추천 기준 경로를 `/recommendations`로 변경함. 기존 `/menu-4`는 쿼리 보존 리다이렉트로 유지
- 완료: 구매장부의 모바일·데스크톱 완료 입력과 완료 취소에서 반복되던 기본값·경고·mutation·busy 상태 처리를 공통 훅으로 정리함
- 완료: 모바일 주문 카드의 상위 `key={row.id}`로 이미 초기화되는 페이지 state를 effect에서 다시 설정하지 않도록 정리해 React lint 오류를 제거함
- 확인 결과: Next 16.2.3 문서상 `lucide-react`와 `recharts`는 이미 `optimizePackageImports` 기본 최적화 대상이므로 별도 `next.config.ts` 변경은 하지 않음
- 완료: 대시보드와 월별 상세는 실제 사용 필드만 명시적으로 조회하고, 1,000건 단위 페이지네이션으로 전체 주문을 누락 없이 읽음
- 완료: 설정 패널의 `purchase-templates` view 렌더링과 템플릿 목록 표시 책임을 `PurchaseTemplatesSettingsView` top-level 컴포넌트로 분리함
- 완료: 설정 패널의 `ai` view 입력 렌더링 책임을 `AiReviewSettingsView` top-level 컴포넌트로 분리하고, 부모의 상태·Supabase 저장 책임은 유지함
- 완료: 설정 패널의 `platforms` view 목록·추가 UI를 `PlatformSettingsView` top-level 컴포넌트로 분리하고, 부모의 상태·Supabase mutation 책임은 유지함
- 완료: 설정 패널의 `payment-methods` view 목록·추가 UI를 `PaymentMethodSettingsView` top-level 컴포넌트로 분리하고, 부모의 상태·Supabase mutation 책임은 유지함
- 완료: 설정 패널의 `buyer-accounts` view 목록·추가 UI를 `BuyerAccountSettingsView` top-level 컴포넌트로 분리하고, 부모의 상태·Supabase mutation 책임은 유지함
- 완료: 설정 패널의 `account` view 계정 정보·닉네임 이동 UI를 `AccountSettingsView` top-level 컴포넌트로 분리하고, 부모의 상태·callback 책임은 유지함
- 완료: 설정 패널의 `nickname` view 입력·저장 UI를 `NicknameSettingsView` top-level 컴포넌트로 분리하고, 부모의 상태·Supabase mutation 책임은 유지함
- 완료: 설정 패널의 `defaults` view 주문 기본값·업무 흐름 UI를 `OrderDefaultsSettingsView` top-level 컴포넌트로 분리하고, 부모의 preferences 상태·숨김 필터·Supabase mutation 책임은 유지함
- 완료: 설정 패널의 홈 요약·메뉴·PWA·로그아웃 UI를 `SettingsHomeView` top-level 컴포넌트로 분리하고, 부모의 상태·navigation/logout callback 책임은 유지함
- 완료: `OrderCardItem` 확장 패널을 memoized 경계로 유지하고 row별 수정·복제·patch callback을 안정화함. 부모의 기존 stable callback과 주문 동작은 유지함
- 완료: `order-detail-form.tsx`의 AI 리뷰 스트리밍 상태·결과 표시·생성/복사 책임을 memoized `AiReviewPanel`로 분리하고, 부모의 주문 입력·draft/dirty guard·저장 책임은 유지함
- 완료: `crawl-orders-page.tsx`의 주문 추천·입금 추천·최근 처리/숨김 탭 UI를 top-level memoized 컴포넌트로 분리하고, 부모의 Supabase 조회·polling·mutation 책임과 현재 탭만 마운트하는 동작은 유지함
- 완료: `orders-table.tsx`의 미완료 주문 헤더·데스크톱 표·모바일 카드 UI를 top-level memoized `PendingOrdersSection`으로 분리하고, 부모의 조회·필터·가상 스크롤 계산·완료/삭제 mutation 책임과 현재 viewport branch만 마운트하는 동작은 유지함
- 완료: `orders-table.tsx`의 완료 주문 헤더·데스크톱 표·모바일 카드 UI를 top-level memoized `CompletedOrdersSection`으로 분리하고, 부모의 조회·필터·가상 스크롤 계산·mutation 책임과 현재 viewport branch만 마운트하는 동작은 유지함
- 완료: `order-detail-form.tsx`의 추가 정보·완료정보 입력 UI를 top-level memoized 섹션으로 분리하고, 부모의 draft·dirty guard·저장 책임과 기존 입력 동작은 유지함
- 완료: `crawl-orders-page.tsx`의 선택 주문 검수 레이아웃을 top-level memoized 컴포넌트로 분리하고, 저장·숨김 mutation callback을 안정화해 polling·부모 상태 변경이 검수 폼 전체를 다시 렌더링하지 않도록 함
- 부분 완료: `settings-panel.tsx`의 주요 설정 view JSX는 이미 top-level 컴포넌트로 분리되어 있음. 부모의 view 라우팅·상태·Supabase mutation 오케스트레이션은 유지했으며, 추가 래퍼는 prop churn 대비 효과가 없어 만들지 않음
- 부분 완료·보류: 브라우저 Supabase 조회는 기존 SWR 범위를 유지하고, 쿠키 세션·Next.js Proxy와 구매장부·설정 초기 server fetch까지 적용함. 자동추천·기타 상세 화면의 추가 server fetch와 설정 부모 오케스트레이션 분리는 후속 검증이 필요함
- 완료: 구매장부·설정·자동추천의 사용자별 브라우저 조회를 SWR key/fetcher로 캐시하고, 자동추천의 입금·복구 조회는 현재 탭 진입 시에만 실행하도록 전환함. 기존 1,000건 페이지네이션과 mutation 후 화면 갱신 동작은 유지함

## 기준 검증 결과

기준선은 다음 명령으로 확인했다.

- `npm run lint`: 통과
- `npm test`: 2개 파일, 9개 테스트 통과
- `npm run build`: Next.js 16.2.3 빌드 통과

현재 코드에는 이미 다음 패턴이 적용되어 있으므로 불필요하게 다시 변경하지 않는다.

- 구매장부의 미완료 조회와 count 조회 병렬화, 완료 목록 지연 조회
- 검색 입력의 `useDeferredValue`
- 자동추천의 현재 탭만 마운트하는 구조와 추천 결과 버전 캐시
- 주문 상세/신규 주문/대시보드의 독립 조회 `Promise.all`
- 선택 모드에서만 필요한 master data를 조회하는 지연 로딩
- 대시보드 통계의 `Map` 기반 그룹화

## 이슈 목록

| 우선순위 | 현재 문제 | 적용 규칙 | 수정 대상 | 위험도 |
| --- | --- | --- | --- | --- |
| 완료 | 클릭할 때만 사용하는 `xlsx`를 export 동작 시점에 로드하도록 분리함 | `bundle-conditional`, `bundle-dynamic-imports` | [`src/lib/export-dashboard-excel.ts`](src/lib/export-dashboard-excel.ts), [`src/components/pages/dashboard-page.tsx`](src/components/pages/dashboard-page.tsx), [`src/components/orders/orders-dashboard.tsx`](src/components/orders/orders-dashboard.tsx), [`src/components/orders/orders-table.tsx`](src/components/orders/orders-table.tsx) | 높음 |
| 완료 | 대시보드 전용 차트와 Recharts를 dynamic import로 분리함 | `bundle-dynamic-imports` | [`src/components/dashboard/dashboard-charts.tsx`](src/components/dashboard/dashboard-charts.tsx), [`src/components/orders/orders-dashboard.tsx`](src/components/orders/orders-dashboard.tsx) | 중간~높음 |
| 완료 | 활성 viewport에 필요한 가상 범위만 계산하도록 정리함 | `rerender-split-combined-hooks`, `rerender-memo` | [`src/components/orders/orders-table.tsx`](src/components/orders/orders-table.tsx) | 중간 |
| 완료 | 크롤링 추천의 모바일·데스크톱 branch를 현재 viewport 하나만 마운트하도록 정리함 | `rendering-content-visibility`, `rerender-memo` | [`src/components/pages/crawl-orders-page.tsx`](src/components/pages/crawl-orders-page.tsx) | 중간~높음 |
| 완료 | 주문번호 중복 조회와 날짜·상품 중복 조회를 `Promise.all`로 병렬화함 | `async-parallel` | [`src/components/orders/order-detail-form.tsx`](src/components/orders/order-detail-form.tsx) | 중간 |
| 완료 | 크롤링 polling을 계정 상태 확인과 필요한 목록 동기화로 분리함 | `async-defer-await`, `rerender-split-combined-hooks` | [`src/components/pages/crawl-orders-page.tsx`](src/components/pages/crawl-orders-page.tsx) | 중간~높음 |
| 완료 | `OrderCardItem` 확장 패널의 row 바인딩 callback과 memo 경계를 정리함. 부모의 기존 stable callback은 유지함 | `rerender-memo`, `rerender-functional-setstate` | [`src/components/orders/orders-table.tsx`](src/components/orders/orders-table.tsx) | 중간 |
| 완료 | AI streaming delta마다 2천 줄이 넘는 주문 폼 전체가 다시 렌더링됨 | `rerender-memo`, `rerender-use-ref-transient-values` | [`src/components/orders/order-detail-form.tsx`](src/components/orders/order-detail-form.tsx) | 중간 |
| 완료 | 크롤링 화면의 세 탭 UI와 반응형 목록·표 JSX가 부모 render helper에 집중됨 | `rerender-memo`, `rerender-no-inline-components` | [`src/components/pages/crawl-orders-page.tsx`](src/components/pages/crawl-orders-page.tsx) | 중간~높음 |
| 완료 | 구매장부의 미완료 주문 헤더·표·카드 JSX가 `OrdersTable`의 데이터·mutation 책임과 한 render 범위에 집중됨 | `rerender-memo`, `rerender-no-inline-components` | [`src/components/orders/orders-table.tsx`](src/components/orders/orders-table.tsx) | 중간 |
| 완료 | 구매장부의 완료 주문 헤더·표·카드 JSX가 `OrdersTable`의 데이터·mutation 책임과 한 render 범위에 집중됨 | `rerender-memo`, `rerender-no-inline-components` | [`src/components/orders/orders-table.tsx`](src/components/orders/orders-table.tsx) | 중간 |
| 완료 | 설정 초기 조회의 템플릿별 주문 사용량 count N+1을 제거하고 필요한 view에서만 조회함 | `async-defer-await`, `async-parallel` | [`src/components/pages/settings-page.tsx`](src/components/pages/settings-page.tsx), [`src/components/settings/settings-panel.tsx`](src/components/settings/settings-panel.tsx) | 중간 |
| 확인 완료(코드 변경 없음) | Next 16.2.3 문서와 빌드 결과에서 `lucide-react`·`recharts`가 기본 package import 최적화 대상임을 확인함 | `bundle-barrel-imports` | `next.config.ts`, `src/components/**/*.tsx`, `src/components/pages/**/*.tsx` | 낮음 |
| 부분 완료·보류 | 주문 폼·크롤링·장부·설정의 실제 렌더 경계를 안전 범위에서 분리하고 브라우저 SWR 조회 캐시를 적용함. 구매장부·설정 초기 조회의 server fetch까지 적용했으며 자동추천·기타 상세 화면의 추가 server fetch는 보류함 | `rerender-memo`, `rerender-split-combined-hooks`, `rerender-no-inline-components`, `async-defer-await` | [`src/components/orders/order-detail-form.tsx`](src/components/orders/order-detail-form.tsx), [`src/components/pages/crawl-orders-page.tsx`](src/components/pages/crawl-orders-page.tsx), [`src/components/pages/home-page.tsx`](src/components/pages/home-page.tsx), [`src/components/pages/settings-page.tsx`](src/components/pages/settings-page.tsx), [`src/components/orders/orders-table.tsx`](src/components/orders/orders-table.tsx), [`src/components/settings/settings-panel.tsx`](src/components/settings/settings-panel.tsx), [`src/lib/home-data.ts`](src/lib/home-data.ts), [`src/lib/settings-data.ts`](src/lib/settings-data.ts), [`src/lib/supabase/server.ts`](src/lib/supabase/server.ts), [`src/proxy.ts`](src/proxy.ts) | 중간~높음 |
| 완료 | 모바일/데스크톱 완료처리와 완료 취소 UI에 유사한 상태·mutation 로직이 반복됨 | 저장소 재사용 원칙, `rerender-memo` | [`src/components/orders/orders-table.tsx`](src/components/orders/orders-table.tsx), [`src/lib/order-completion.ts`](src/lib/order-completion.ts) | 중간~높음 |
| 완료 | 크롤링 페이지의 입금 추천 로컬 render helper를 `DepositRecommendationList` top-level 컴포넌트로 분리함 | `rerender-no-inline-components`, `rerender-memo`, `js-combine-iterations` | [`src/components/pages/crawl-orders-page.tsx`](src/components/pages/crawl-orders-page.tsx) | 중간 |
| 완료 | 전역 layout의 온보딩을 별도 dynamic chunk로 지연 로드하고, 기존 컴포넌트의 인증 확인·표시 동작은 유지함 | `bundle-dynamic-imports` | [`src/app/layout.tsx`](src/app/layout.tsx), [`src/components/onboarding/onboarding-tour-loader.tsx`](src/components/onboarding/onboarding-tour-loader.tsx) | 중간 |
| 완료 | 설정 화면의 템플릿 사용량 조회를 필요한 view에서만 실행하도록 지연함 | `async-defer-await` | [`src/components/pages/settings-page.tsx`](src/components/pages/settings-page.tsx), [`src/components/settings/settings-panel.tsx`](src/components/settings/settings-panel.tsx) | 중간 |
| 완료 | 온보딩 capture scroll listener에 passive 옵션을 적용함 | `client-passive-event-listeners` | [`src/components/onboarding/onboarding-tour.tsx`](src/components/onboarding/onboarding-tour.tsx) | 낮음 |
| 완료 | 작은 파생 계산·불필요한 객체 생성·dirty snapshot 계산을 안전 범위에서 정리함 | `rerender-simple-expression-in-memo`, `rendering-hoist-jsx`, `rerender-dependencies` | [`src/components/orders/orders-table.tsx`](src/components/orders/orders-table.tsx), [`src/components/orders/order-detail-form.tsx`](src/components/orders/order-detail-form.tsx) | 낮음~중간 |
| 완료 | URL 필터 동기화가 모든 필터 state를 다시 설정할 수 있고, master/hidden 목록에 작은 반복 검색이 있음 | `rerender-dependencies`, `js-set-map-lookups`, `js-index-maps` | [`src/components/orders/orders-table.tsx`](src/components/orders/orders-table.tsx), [`src/lib/master-data.ts`](src/lib/master-data.ts) | 낮음 |
| 완료 | 대시보드·월별 상세가 `*`와 미사용 템플릿 관계까지 가져오고 1,000건 이후 행을 보장하지 않음 | `async-defer-await`, Supabase 1,000건 페이지네이션 규칙 | [`src/lib/dashboard-data.ts`](src/lib/dashboard-data.ts), [`src/types/orders.ts`](src/types/orders.ts), [`src/components/pages/dashboard-page.tsx`](src/components/pages/dashboard-page.tsx), [`src/components/pages/monthly-dashboard-detail-page.tsx`](src/components/pages/monthly-dashboard-detail-page.tsx) | 중간 |

## 실행 순서

### 0단계: 기준선과 동작 보존 장치 — 완료

1. 변경 전 `npm run lint`, `npm test`, `npm run build` 결과를 기준선으로 기록한다.
2. 장부의 모바일/데스크톱 목록, 완료처리 경고, 선택 일괄처리, 크롤링 탭·polling, 대시보드 엑셀, 월별 차트, 설정 템플릿 사용량을 확인할 수 있는 수동 검증 항목을 만든다.
3. 중복 조회·주문 완료·입금 완료의 기존 테스트와 `src/lib/order-completion.ts`의 공통 규칙을 먼저 보호 대상으로 지정한다.

### 1단계: 초기 번들에서 지연 가능한 기능 분리 — 완료

1. `export-dashboard-excel`을 export 버튼 이벤트 시점의 dynamic import로 전환한다. 다운로드 파일, 버튼 상태, 오류 처리는 현재 동작을 유지한다.
2. `DashboardCharts`를 대시보드 화면에서 dynamic import하고 기존 카드·차트 영역의 fallback 높이와 레이아웃을 보존한다.
3. Next 16 설치 문서와 빌드 결과를 확인한다. `lucide-react`와 Recharts가 기본 최적화 대상이므로 별도 설정·direct import 변경은 보류한다.
4. 변경 전후 route chunk를 비교하고, 대시보드·구매장부에 진입하지 않는 라우트의 초기 번들에 export/차트 코드가 남지 않는지 확인한다.

### 2단계: 조회와 가상화 비용 줄이기 — 완료

1. 주문 상세의 두 중복 후보 조회를 같은 debounce/cancellation 경계 안에서 `Promise.all`로 시작하고, 결과 병합 순서와 최대 후보 수를 유지한다.
2. 크롤링 polling을 작은 상태 확인 조회와 필요 시의 전체 목록 동기화로 분리한다. 계정 상태 문구, 완료/실패 메시지, 수동 새로고침 동작은 유지한다.
3. 장부의 활성 viewport에 필요한 가상 범위만 계산하도록 훅 입력을 정리한다. React Hooks 호출 순서와 모바일/데스크톱 전환 안정성을 먼저 설계하고, 실제로는 한 목록 branch만 마운트되도록 유지한다.
4. 크롤링 주문·입금 추천의 모바일/데스크톱 branch도 한 번에 하나만 마운트하도록 바꾼다. breakpoint 전환, row hover, 삭제·펼치기·검수 동작을 확인한다.

### 3단계: 렌더 경계와 callback 안정화 — 완료(안전 범위)

1. `OrderCardItem`에 전달되는 선택·펼치기·수정·복제·삭제·swipe callback을 안정화해 memo가 실제로 작동하도록 한다. 상태 변경은 가능한 functional setState를 사용한다.
2. AI 리뷰 스트림을 별도 memoized 영역으로 분리한다. 스트리밍 텍스트의 갱신이 주문 입력·요약·완료처리 영역을 다시 그리지 않도록 하되, 취소·재시도·저장 전 stream 순서는 유지한다.
3. 완료: 크롤링 페이지의 주문·입금·복구 탭 섹션을 top-level memoized component로 분리하고, 현재 탭만 렌더링하는 기존 동작을 유지했다.
4. 완료: 장부 완료 주문 섹션을 top-level memoized component로 분리하고, 조회·필터·가상 스크롤·mutation 책임과 데스크톱 표/모바일 카드 단일 branch 마운트를 유지했다.
5. 완료: 장부 미완료 주문 섹션을 top-level memoized component로 분리하고, 조회·필터·가상 스크롤·완료/삭제 mutation 책임과 데스크톱 표/모바일 카드 단일 branch 마운트를 유지했다.
6. 완료: 주문 상세의 추가 정보·완료정보 입력 섹션을 top-level memoized 컴포넌트로 분리하고 입력·dirty guard·저장 동작을 유지했다.
7. 완료: 크롤링 선택 주문 검수 레이아웃을 top-level memoized 컴포넌트로 분리하고 저장·숨김 callback을 안정화했다.
8. 이 단계에서는 전역 context, 범용 form framework, 대규모 reducer 도입을 하지 않는다. 설정 부모 오케스트레이션의 추가 분리는 prop churn 대비 이득이 확인되지 않아 보류한다.

### 4단계: 중복 책임과 설정 조회 정리 — 완료

1. 완료: 모바일/데스크톱 완료처리에서 공통인 기본값·입력 검증·warning·mutation 결과 처리를 공통 훅으로 정리했다. UI별 입력 배치는 그대로 유지했다.
2. 완료: 취소 mutation도 같은 방식으로 중복을 줄였고, 완료 주문과 미완료 주문의 기존 입금 정보 규칙은 변경하지 않았다.
3. 완료: 설정 템플릿 사용량은 현재 view에서 필요할 때만 지연 조회하고, 기존 목록에 표시되는 사용 주문 수는 동일하게 유지한다. 스키마나 새로운 서버 API는 만들지 않았다.
4. 완료: 전역 온보딩은 로더에서 첫 렌더 직후 dynamic import하고, 게스트 화면에서는 튜토리얼이 표시되지 않는지 확인했다. 인증 계정이 없어 첫 로그인 저장 흐름은 별도 확인이 필요하다.
5. 완료: scroll listener에 passive 옵션을 추가하고 capture와 cleanup 동작을 보존했다.

### 5단계: 낮은 위험도의 계산·유지보수 정리 — 완료(안전 범위)

1. 완료: 단순한 `useMemo`와 모듈 수준에서 안전하게 고정할 수 있는 정적 객체를 정리했다.
2. 완료: 주문 폼 dirty snapshot과 URL 필터 동기화는 state의 의미를 바꾸지 않는 범위에서 비교 비용과 불필요한 setter 호출을 줄였다.
3. 완료: master data의 숨김 ID membership에 `Set`을 적용했다. 반복 lookup이 실제 데이터 크기에서 의미가 있는 경우에만 자료구조를 바꾼다.
4. 완료: 대시보드·월별 상세가 사용하는 주문 필드와 관계 필드만 조회하도록 전용 select를 만들고, `purchase_date`·`id` 안정 정렬과 1,000건 단위 range 반복 조회를 적용했다. 서버 집계·RPC로 확장하지 않았다.

### 6단계: 브라우저 조회 SWR 캐시 전환 — 완료

1. 완료: `swr` 의존성을 추가하고 사용자 ID를 포함한 key/fetcher로 구매장부의 count·미완료·완료 지연 조회를 분리했다.
2. 완료: 설정 초기 조회와 주문 휴지통 조회를 view·사용자별 SWR key로 캐시하고, 기존 mutation 뒤의 화면 갱신을 캐시 갱신으로 연결했다.
3. 완료: 자동추천의 기본 주문·마스터·플랫폼 계정 조회와 입금·복구 탭 조회를 SWR로 전환했다. 입금·주문 후보의 1,000건 단위 전체 페이지 조회는 유지했다.
4. 완료: 기존 브라우저 조회는 SWR 범위로 유지했다. 다음 단계의 server fetch가 초기 데이터와 브라우저 재검증을 함께 사용할 수 있도록 조회 key와 mutation 후 갱신 동작을 보존했다.

### 7단계: 쿠키 기반 server fetch — 부분 완료

1. 완료: `@supabase/ssr` 브라우저·서버 클라이언트와 Next.js 16 `proxy.ts`를 추가해 인증 쿠키 갱신 경계를 마련했다. 기존 Supabase URL/key와 public 스키마를 그대로 사용했다.
2. 완료: 구매장부(`/`)의 인증 사용자, 주문 count, 미완료 주문 초기 조회를 서버에서 병렬로 가져오고 클라이언트 SWR의 초기값으로 주입했다. 완료 주문의 지연 조회와 로그아웃 후 게스트 전환은 유지했다.
3. 완료: 설정 화면은 계정·공통 master data·사용자 설정·휴지통 count를 서버에서 초기 조회하고, view 진입 시 템플릿 사용량 지연 조회와 mutation 후 SWR 갱신을 유지했다.
4. 진행 예정: 자동추천은 query parameter·탭별 조건부 목록의 초기 데이터만 서버에서 주입하고, 기존 1,000건 페이지네이션·추천 캐시·현재 탭만 마운트하는 동작을 유지한다.
5. 보류: 주문 상세처럼 입력·draft·중복 조회가 결합된 화면은 자동추천 단계 이후 별도 범위로 판단한다.

## 단계별 검증

- 각 단계: `npm run lint`, `npm test`, `npm run build`
- 번들 단계: Next build 산출물에서 `xlsx`, Recharts, icon import가 필요한 route에만 포함되는지 비교
- 장부 단계: 검색·deferred value·기간 필터·가상 스크롤·완료 목록 지연 조회·모바일/데스크톱 전환
- 주문 폼 단계: draft 저장, 중복 후보, dirty guard, AI stream, 완료 경고와 수익 계산
- 자동추천 단계: 세 탭 전환, 1,000건 초과 pagination, polling, 삭제/복원, 후보 캐시
- 설정 단계: 모든 `?view` 화면, 템플릿 사용량·복제·삭제, 온보딩·PWA 카드
- 실패 시 해당 단계의 변경만 되돌릴 수 있도록 작은 커밋 단위로 유지한다.

## 최근 변경 검증

- `npx tsc --noEmit`: 통과
- `npm test`: 2개 파일, 9개 테스트 통과
- `npm run build`: 통과
- `npm run lint`: 통과
- Playwright: `/dashboard`, `/dashboard/monthly?month=2026-08` 렌더링 및 Supabase 주문 요청 확인. 명시적 select, `offset=0&limit=1000`, `purchase_date.desc,id.desc`, 월별 날짜 범위가 반영되었고 브라우저 오류 0건
- Playwright: `/settings`와 `/settings?view=purchase-templates`를 데스크톱·모바일에서 확인. 템플릿 목록·추가·상세 링크·기본/복제/복사/삭제 버튼이 표시되고 브라우저 오류 0건
- Playwright: `/settings?view=ai`를 데스크톱·모바일에서 확인. AI 입력 필드·저장 버튼이 표시되고 브라우저 오류 0건
- Playwright: `/settings?view=platforms`를 데스크톱·모바일에서 확인. 플랫폼 목록·색상/숨김 버튼·추가 입력이 표시되고 입력 시 추가 버튼 활성화 및 브라우저 오류 0건
- Playwright: `/settings?view=payment-methods`를 데스크톱·모바일에서 확인. 결제 수단 목록·색상/숨김 버튼·추가 입력이 표시되고 입력 시 추가 버튼 활성화 및 브라우저 오류 0건
- Playwright: `/settings?view=buyer-accounts`를 데스크톱·모바일에서 확인. 구매 계정 목록·색상/삭제 버튼·추가 입력이 표시되고 입력 시 추가 버튼 활성화 및 브라우저 오류 0건
- Playwright: `/settings?view=account`를 데스크톱·모바일에서 확인. 계정 정보와 닉네임 이동 버튼을 표시하고 닉네임 변경 화면 이동 및 브라우저 오류 0건을 확인함
- Playwright: `/settings?view=nickname`을 데스크톱·모바일에서 확인. 닉네임 입력·저장 버튼과 입력에 따른 저장 버튼 활성화 및 브라우저 오류 0건을 확인함
- Playwright: `/settings?view=defaults`를 데스크톱·모바일에서 확인. 주문 기본값 선택지·업무 흐름 선택지·자동추천 연속 처리 체크박스와 브라우저 오류 0건을 확인함
- Playwright: `/settings`를 데스크톱·모바일에서 확인. PWA 카드·계정 요약·설정 메뉴·휴지통 배지·로그아웃 버튼과 계정 요약 이동 및 브라우저 오류 0건을 확인함
- Playwright: `/`를 데스크톱·모바일에서 확인. 구매장부 테이블·필터·완료 주문 섹션과 모바일 주문 펼침/입금 입력 패널 및 브라우저 오류 0건을 확인함
- `npx tsc --noEmit`: 통과
- Playwright: 주문 상세 화면을 데스크톱·390px 모바일에서 확인. AI 리뷰 패널을 펼쳐 추가 정보 입력·생성 버튼·결과 영역이 표시되고, 모바일 가로 overflow와 브라우저 error 0건을 확인함
- Playwright: `/recommendations`를 데스크톱·390px 모바일에서 확인. 주문·입금·최근 처리/숨김 탭 전환과 각 탭 핵심 빈 상태 UI, 현재 탭만 DOM에 마운트되는 구조, 모바일 가로 overflow 없음 및 브라우저 error 0건을 확인함
- `npm run lint`: 통과
- `npx tsc --noEmit`: 통과
- `npm test`: 2개 파일, 9개 테스트 통과
- `npm run build`: Next.js 16.2.3 빌드 통과
- Playwright: `/`의 완료 주문 섹션을 1440px·390px에서 펼쳐 확인. 데스크톱은 완료 표만, 모바일은 완료 카드만 마운트되고 완료 행이 표시되며 두 viewport에서 body 가로 overflow와 브라우저 error 0건을 확인함
- `npm run lint`: 통과
- `npx tsc --noEmit`: 통과
- `npm test`: 2개 파일, 9개 테스트 통과
- `npm run build`: Next.js 16.2.3 빌드 통과
- Playwright: `/`의 미완료 주문 영역을 1440px·390px에서 확인. 데스크톱은 미완료 표만, 모바일은 미완료 카드만 마운트되고 모바일 카드 확장·데스크톱 완료처리 입력이 동작하며 두 viewport에서 body 가로 overflow와 브라우저 error 0건을 확인함
- 이번 묶음 `npm run lint`: 통과
- 이번 묶음 `npx tsc --noEmit`: 통과
- 이번 묶음 `npm test`: 2개 파일, 9개 테스트 통과
- 이번 묶음 `npm run build`: Next.js 16.2.3 빌드 통과
- 이번 묶음 Playwright: `/orders/new`의 추가 정보 펼침·완료정보 입력 영역을 1440px·390px에서 확인하고 가로 overflow와 브라우저 error 0건을 확인함
- 이번 묶음 Playwright: `/recommendations`의 주문·입금·최근 처리/숨김 탭 전환을 1440px·390px에서 확인하고 가로 overflow와 브라우저 error 0건을 확인함. 현재 `crawl_orders` 대기 건수가 0건이라 선택 주문 검수 저장 흐름은 진입 데이터가 없어 실행하지 못함
- 이번 묶음 Playwright: `/settings` 홈을 1440px·390px에서 확인하고 설정 메뉴·PWA 카드·계정 요약, 가로 overflow와 브라우저 error 0건을 확인함
- SWR 묶음 `npm run lint`: 통과
- SWR 묶음 `npx tsc --noEmit`: 통과
- SWR 묶음 `npm test`: 2개 파일, 9개 테스트 통과
- SWR 묶음 `npm run build`: Next.js 16.2.3 빌드 통과
- SWR 묶음 Playwright: `/recommendations`를 1440px·390px에서 확인하고 주문 탭의 기본 조회, 입금·복구 탭 진입 시 조건부 조회, 모바일 가로 overflow와 브라우저 error 0건을 확인함
- 쿠키 인증 묶음 `npm run lint`: 통과
- 쿠키 인증 묶음 `npx tsc --noEmit`: 통과
- 쿠키 인증 묶음 `npm test`: 2개 파일, 9개 테스트 통과
- 쿠키 인증 묶음 `npm run build`: Next.js 16.2.3 빌드 통과. `/`가 동적 route로 생성되고 Proxy가 인식됨
- 쿠키 인증 묶음 Playwright: 테스트 계정으로 로그인 시 인증 쿠키가 생성되고 `/`의 인증 UI와 server 초기 데이터를 확인함. `/` 진입 시 브라우저의 `orders` 목록/count 요청이 발생하지 않았고, 로그아웃 후 게스트 화면·가로 overflow 없음·브라우저 error 0건을 확인함
- 설정 server fetch 묶음 Playwright: `/settings?view=account`와 `purchase-templates`의 계정·템플릿 목록·사용량을 1440px·390px에서 확인함. 브라우저에는 인증 확인 외 설정 테이블 조회가 없었고 모바일 가로 overflow 없음·브라우저 error 0건을 확인함

## 명시적 제외

- API endpoint, request/response contract, Supabase 테이블·컬럼·인덱스·RLS 변경
- 모든 화면의 브라우저 Supabase 인증 조회를 쿠키 기반 server fetch로 일괄 전환
- 주문·입금 데이터를 오프라인에 영속화하거나 freshness 의미를 바꾸는 SWR 전환
- 디자인 토큰, 화면 정보 구조, 반응형 breakpoint의 재설계
- 실제 프로파일링으로 유의미한 비용이 확인되지 않은 저수준 알고리즘·전역 추상화 변경
