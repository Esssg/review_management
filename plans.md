# React Best Practices 전체 검토 후속 계획

작성일: 2026-08-10

## 목적

현재 동작과 UI를 유지하면서 React Best Practices와 저장소 개발/UI 규칙에 맞지 않는 렌더링, 데이터 조회, 번들, 중복 책임을 단계적으로 개선한다.

## 변경 제약

- 기능 동작과 화면 구조·스타일을 유지한다.
- API contract, Supabase public 스키마, RLS, 데이터 의미를 변경하지 않는다.
- 현재 브라우저 Supabase 인증·조회 구조를 전제로 하며, 서버 컴포넌트/RPC/SWR 전환은 1차 범위에서 제외한다.
- 기존의 병렬 조회, 지연 조회, 가상 스크롤, 추천 캐시처럼 의도적으로 적용된 최적화는 유지한다.
- 새 추상화는 반복 책임이나 렌더 경계를 실제로 줄이는 경우에만 도입한다.
- 각 단계마다 관련 테스트와 린트·빌드를 실행하고, UI 변경 가능성이 있는 단계는 모바일·데스크톱을 모두 확인한다.

## 현재 적용 상태

- 완료: `xlsx` 클릭 시점 로딩, 대시보드 차트 dynamic import, 장부 가상 범위 계산 축소, 크롤링 반응형 branch 단일 마운트, 중복 조회 병렬화, 크롤링 상태 polling 경량화
- 완료: 장부 카드 callback 안정화, AI stream 프레임 단위 반영, 설정 템플릿 사용량 N+1 제거, 완료처리 mutation 공통화, media query 공통 hook, passive scroll listener, 작은 파생 계산 정리
- 확인 결과: Next 16.2.3 문서상 `lucide-react`와 `recharts`는 이미 `optimizePackageImports` 기본 최적화 대상이므로 별도 `next.config.ts` 변경은 하지 않음
- 보류: 대형 화면 컴포넌트의 추가 분리, 전역 온보딩 dynamic loading, 대시보드 전체 데이터 조회 축소, SWR/server fetch 전환은 동작·인증·데이터 freshness 영향이 커 별도 측정 후 진행

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
| P0 | 클릭할 때만 사용하는 `xlsx`가 대시보드·구매장부 초기 클라이언트 번들에 정적으로 포함됨 | `bundle-conditional`, `bundle-dynamic-imports` | [`src/lib/export-dashboard-excel.ts`](src/lib/export-dashboard-excel.ts), [`src/components/pages/dashboard-page.tsx`](src/components/pages/dashboard-page.tsx), [`src/components/orders/orders-dashboard.tsx`](src/components/orders/orders-dashboard.tsx), [`src/components/orders/orders-table.tsx`](src/components/orders/orders-table.tsx) | 높음 |
| P1 | 차트가 대시보드 전용인데 `DashboardCharts`와 Recharts가 정적으로 로드됨 | `bundle-dynamic-imports` | [`src/components/dashboard/dashboard-charts.tsx`](src/components/dashboard/dashboard-charts.tsx), [`src/components/orders/orders-dashboard.tsx`](src/components/orders/orders-dashboard.tsx) | 중간~높음 |
| P1 | 실제로 사용하지 않는 반응형 목록까지 포함해 네 개의 가상 범위 훅을 항상 계산함 | `rerender-split-combined-hooks`, `rerender-memo` | [`src/components/orders/orders-table.tsx`](src/components/orders/orders-table.tsx) | 중간 |
| P1 | 크롤링 추천 화면의 모바일 목록과 데스크톱 표를 동시에 렌더링함 | `rendering-content-visibility`, `rerender-memo` | [`src/components/pages/crawl-orders-page.tsx`](src/components/pages/crawl-orders-page.tsx) | 중간~높음 |
| P1 | 주문번호 중복 조회와 날짜·상품 중복 조회가 서로 독립적인데 순차 실행됨 | `async-parallel` | [`src/components/orders/order-detail-form.tsx`](src/components/orders/order-detail-form.tsx) | 중간 |
| P1 | 크롤링 상태 polling 때마다 주문·master data·계정 상태를 모두 다시 조회함 | `async-defer-await`, `rerender-split-combined-hooks` | [`src/components/pages/crawl-orders-page.tsx`](src/components/pages/crawl-orders-page.tsx) | 중간~높음 |
| P1 | `OrderCardItem`이 memoized 되어도 부모의 인라인 콜백 때문에 대부분 다시 렌더링됨 | `rerender-memo`, `rerender-functional-setstate` | [`src/components/orders/orders-table.tsx`](src/components/orders/orders-table.tsx) | 중간 |
| P1 | AI streaming delta마다 2천 줄이 넘는 주문 폼 전체가 다시 렌더링됨 | `rerender-memo`, `rerender-use-ref-transient-values` | [`src/components/orders/order-detail-form.tsx`](src/components/orders/order-detail-form.tsx) | 중간 |
| P1 | 설정 초기 조회에서 템플릿마다 주문 사용량 count 쿼리를 하나씩 실행함 | `async-defer-await`, `async-parallel` | [`src/components/pages/settings-page.tsx`](src/components/pages/settings-page.tsx), [`src/components/settings/settings-panel.tsx`](src/components/settings/settings-panel.tsx) | 중간 |
| P2 | 여러 파일에서 `lucide-react` named import를 사용하지만 Next 16 기본 최적화 대상인지 확인이 필요했음 | `bundle-barrel-imports` | `src/components/**/*.tsx`, `src/components/pages/**/*.tsx` | 낮음 |
| P2 | 주문 폼·크롤링 화면·장부·설정 패널이 데이터 조회부터 여러 화면의 JSX까지 한 컴포넌트에 집중됨 | `rerender-memo`, `rerender-split-combined-hooks`, `rerender-no-inline-components` | [`src/components/orders/order-detail-form.tsx`](src/components/orders/order-detail-form.tsx), [`src/components/pages/crawl-orders-page.tsx`](src/components/pages/crawl-orders-page.tsx), [`src/components/orders/orders-table.tsx`](src/components/orders/orders-table.tsx), [`src/components/settings/settings-panel.tsx`](src/components/settings/settings-panel.tsx) | 중간~높음 |
| P2 | 모바일/데스크톱 완료처리와 완료 취소 UI에 유사한 상태·mutation 로직이 반복됨 | 저장소 재사용 원칙, `rerender-memo` | [`src/components/orders/orders-table.tsx`](src/components/orders/orders-table.tsx), [`src/lib/order-completion.ts`](src/lib/order-completion.ts) | 중간~높음 |
| P2 | 크롤링 페이지의 로컬 render helper가 부모 렌더마다 새 closure와 JSX를 계산함 | `rerender-no-inline-components`, `rerender-memo`, `js-combine-iterations` | [`src/components/pages/crawl-orders-page.tsx`](src/components/pages/crawl-orders-page.tsx) | 중간 |
| P2 | 전역 layout이 검색 팔레트·온보딩을 모든 라우트에서 마운트하고, 온보딩은 인증 상태를 별도로 확인함 | `bundle-dynamic-imports`, `client-swr-dedup`, `client-event-listeners` | [`src/app/layout.tsx`](src/app/layout.tsx), [`src/components/onboarding/onboarding-tour.tsx`](src/components/onboarding/onboarding-tour.tsx) | 중간 |
| P2 | 설정 화면이 현재 view와 무관한 템플릿 상세·사용량까지 항상 조회함 | `async-defer-await` | [`src/components/pages/settings-page.tsx`](src/components/pages/settings-page.tsx) | 중간 |
| P2 | 온보딩의 capture scroll listener가 실제로 `preventDefault`를 사용하지 않는데 passive 옵션이 없음 | `client-passive-event-listeners` | [`src/components/onboarding/onboarding-tour.tsx`](src/components/onboarding/onboarding-tour.tsx) | 낮음 |
| P3 | 단순 배열 치환을 위한 `useMemo`, 매 렌더 객체 생성, 렌더 중 `JSON.stringify` 등 작은 계산이 남아 있음 | `rerender-simple-expression-in-memo`, `rendering-hoist-jsx`, `rerender-dependencies` | [`src/components/orders/orders-table.tsx`](src/components/orders/orders-table.tsx), [`src/components/orders/order-detail-form.tsx`](src/components/orders/order-detail-form.tsx) | 낮음~중간 |
| P3 | URL 필터 동기화가 모든 필터 state를 다시 설정할 수 있고, master/hidden 목록에 작은 반복 검색이 있음 | `rerender-dependencies`, `js-set-map-lookups`, `js-index-maps` | [`src/components/orders/orders-table.tsx`](src/components/orders/orders-table.tsx), [`src/lib/master-data.ts`](src/lib/master-data.ts) | 낮음 |
| P3 | 대시보드·월별 상세가 관계 데이터를 포함한 주문 전체를 클라이언트로 가져옴 | `async-defer-await` | [`src/components/pages/dashboard-page.tsx`](src/components/pages/dashboard-page.tsx), [`src/components/pages/monthly-dashboard-detail-page.tsx`](src/components/pages/monthly-dashboard-detail-page.tsx) | 중간 |

## 실행 순서

### 0단계: 기준선과 동작 보존 장치

1. 변경 전 `npm run lint`, `npm test`, `npm run build` 결과를 기준선으로 기록한다.
2. 장부의 모바일/데스크톱 목록, 완료처리 경고, 선택 일괄처리, 크롤링 탭·polling, 대시보드 엑셀, 월별 차트, 설정 템플릿 사용량을 확인할 수 있는 수동 검증 항목을 만든다.
3. 중복 조회·주문 완료·입금 완료의 기존 테스트와 `src/lib/order-completion.ts`의 공통 규칙을 먼저 보호 대상으로 지정한다.

### 1단계: 초기 번들에서 지연 가능한 기능 분리

1. `export-dashboard-excel`을 export 버튼 이벤트 시점의 dynamic import로 전환한다. 다운로드 파일, 버튼 상태, 오류 처리는 현재 동작을 유지한다.
2. `DashboardCharts`를 대시보드 화면에서 dynamic import하고 기존 카드·차트 영역의 fallback 높이와 레이아웃을 보존한다.
3. Next 16 설치 문서와 빌드 결과를 확인한다. `lucide-react`와 Recharts가 기본 최적화 대상이므로 별도 설정·direct import 변경은 보류한다.
4. 변경 전후 route chunk를 비교하고, 대시보드·구매장부에 진입하지 않는 라우트의 초기 번들에 export/차트 코드가 남지 않는지 확인한다.

### 2단계: 조회와 가상화 비용 줄이기

1. 주문 상세의 두 중복 후보 조회를 같은 debounce/cancellation 경계 안에서 `Promise.all`로 시작하고, 결과 병합 순서와 최대 후보 수를 유지한다.
2. 크롤링 polling을 작은 상태 확인 조회와 필요 시의 전체 목록 동기화로 분리한다. 계정 상태 문구, 완료/실패 메시지, 수동 새로고침 동작은 유지한다.
3. 장부의 활성 viewport에 필요한 가상 범위만 계산하도록 훅 입력을 정리한다. React Hooks 호출 순서와 모바일/데스크톱 전환 안정성을 먼저 설계하고, 실제로는 한 목록 branch만 마운트되도록 유지한다.
4. 크롤링 주문·입금 추천의 모바일/데스크톱 branch도 한 번에 하나만 마운트하도록 바꾼다. breakpoint 전환, row hover, 삭제·펼치기·검수 동작을 확인한다.

### 3단계: 렌더 경계와 callback 안정화

1. `OrderCardItem`에 전달되는 선택·펼치기·수정·복제·삭제·swipe callback을 안정화해 memo가 실제로 작동하도록 한다. 상태 변경은 가능한 functional setState를 사용한다.
2. AI 리뷰 스트림을 별도 memoized 영역으로 분리한다. 스트리밍 텍스트의 갱신이 주문 입력·요약·완료처리 영역을 다시 그리지 않도록 하되, 취소·재시도·저장 전 stream 순서는 유지한다.
3. 크롤링 페이지의 활성 탭별 섹션을 명확한 top-level component로 분리하고, 현재 탭만 렌더링하는 기존 동작을 유지한다.
4. 이 단계에서는 전역 context, 범용 form framework, 대규모 reducer 도입을 하지 않는다.

### 4단계: 중복 책임과 설정 조회 정리

1. 모바일/데스크톱 완료처리에서 공통인 기본값·입력 검증·warning·mutation 결과 처리를 테스트로 고정한 뒤 작은 공통 로직만 추출한다. UI별 입력 배치는 그대로 둔다.
2. 완료 취소 mutation도 같은 방식으로 중복을 줄이되, 완료 주문과 미완료 주문의 기존 입금 정보 규칙을 변경하지 않는다.
3. 설정 템플릿 사용량은 현재 view에서 필요할 때만 지연 조회하고, 기존 목록에 표시되는 사용 주문 수는 동일하게 유지한다. 스키마나 새로운 서버 API는 만들지 않는다.
4. 전역 온보딩은 인증 사용자에게 필요한 경우에만 상세 초기화를 수행하도록 검토하고, 게스트 화면의 auth check와 튜토리얼 표시 타이밍을 수동 확인한다.
5. scroll listener에는 passive 옵션을 추가하되, capture와 cleanup 동작을 보존한다.

### 5단계: 낮은 위험도의 계산·유지보수 정리

1. 단순한 `useMemo`와 모듈 수준에서 안전하게 고정할 수 있는 정적 객체를 정리한다.
2. 주문 폼 dirty snapshot과 URL 필터 동기화는 state의 의미를 바꾸지 않는 범위에서만 비교 비용과 불필요한 setter 호출을 줄인다.
3. 반복 membership/lookup이 실제 데이터 크기에서 의미가 있을 때만 `Set`/`Map`을 적용한다.
4. 대시보드 전체 주문 조회 축소는 UI·데이터 계약을 먼저 측정한 후 별도 과제로 판단한다. 서버 집계나 RPC로 즉시 확장하지 않는다.

## 단계별 검증

- 각 단계: `npm run lint`, `npm test`, `npm run build`
- 번들 단계: Next build 산출물에서 `xlsx`, Recharts, icon import가 필요한 route에만 포함되는지 비교
- 장부 단계: 검색·deferred value·기간 필터·가상 스크롤·완료 목록 지연 조회·모바일/데스크톱 전환
- 주문 폼 단계: draft 저장, 중복 후보, dirty guard, AI stream, 완료 경고와 수익 계산
- 자동추천 단계: 세 탭 전환, 1,000건 초과 pagination, polling, 삭제/복원, 후보 캐시
- 설정 단계: 모든 `?view` 화면, 템플릿 사용량·복제·삭제, 온보딩·PWA 카드
- 실패 시 해당 단계의 변경만 되돌릴 수 있도록 작은 커밋 단위로 유지한다.

## 명시적 제외

- API endpoint, request/response contract, Supabase 테이블·컬럼·인덱스·RLS 변경
- 브라우저 Supabase 인증을 서버 세션/서버 컴포넌트로 전환
- 주문·입금 데이터를 오프라인 캐시하거나 freshness 의미를 바꾸는 SWR 전환
- 디자인 토큰, 화면 정보 구조, 반응형 breakpoint의 재설계
- 실제 프로파일링으로 유의미한 비용이 확인되지 않은 저수준 알고리즘·전역 추상화 변경
