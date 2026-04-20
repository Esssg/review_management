# DB 가이드 (Supabase)

기준 프로젝트: `xhjjoxzwpgqlodflaiix`  
최종 업데이트: 2026-04-20

## 1) 현재 DB에 있는 테이블

### `public` (애플리케이션 데이터)
- `orders` — 주문 레코드 (RLS 활성화)
- `platforms` — 결제 플랫폼 마스터 (RLS 활성화)
- `payment_methods` — 결제 수단 마스터 (RLS 활성화)
- `buyer_accounts` — 사용자별 구매 계정 별칭 (RLS 활성화)
- `purchase_info_templates` — 카톡 등에 붙여넣을 구매 정보 템플릿 (RLS 활성화)
- `user_ai_review_profiles` — AI 리뷰 생성용 사용자 기본 프로필(비식별 위주, RLS 활성화)
- `user_item_settings` — 시스템 기본 항목 숨김 설정 (RLS 활성화)
- `users` — Auth 사용자와 1:1 앱 프로필(`user_id`, 표시 `name`, RLS 활성화). `auth.users` INSERT 트리거로 행 생성

---

## 2) 테이블 상세

### `public.orders`

행 수(조회 시점): 약 100건 | RLS: 활성화

#### 컬럼 정의 및 의미

| 컬럼 | 타입 | Nullable | 의미 |
|---|---|---|---|
| `id` | uuid | NO | 주문 레코드 고유 ID (PK) |
| `user_id` | uuid | NO | 주문 소유 사용자 ID (`auth.users.id` FK) |
| `title` | text | YES | 앱 목록에서 빠르게 식별하기 위한 짧은 제목 (카톡방 이름 등) |
| `product_name` | text | NO | 상품명 |
| `is_processed` | boolean | NO | 주문 처리 완료 여부 (입금 완료) |
| `platform_id` | uuid | YES | 결제 플랫폼 FK → `platforms.id` |
| `payment_method_id` | uuid | YES | 결제 수단 FK → `payment_methods.id` |
| `buyer_account_id` | uuid | YES | 구매 계정 FK → `buyer_accounts.id` |
| `purchase_info_template_id` | uuid | YES | 연결된 구매 정보 템플릿 FK → `purchase_info_templates.id` (삭제 시 NULL) |
| `purchase_date` | date | NO | 실제 구매일 |
| `deposit_date` | date | YES | 입금 확인일 |
| `purchase_price_krw` | numeric | NO | 구매 금액(원) |
| `deposit_amount_krw` | numeric | YES | 입금 금액(원) |
| `profit_krw` | numeric | YES | 수익(원) |
| `is_item_delivered` | boolean | NO | 상품 배송 완료 여부 |
| `deposit_memo` | text | YES | 입금 관련 메모 |
| `notes` | text | YES | 일반 메모 |
| `product_url` | text | YES | 상품 URL |
| `scheduled_purchase_at` | timestamptz | YES | 구매 예정 시각 |
| `order_number` | text | YES | 외부(쇼핑몰 등) 주문번호(선택, 미입력 시 NULL) |
| `screenshot_storage_path` | text | YES | 증빙 스크린샷 저장 경로 |
| `order_status` | text | YES | 주문 상태 텍스트 |
| `review_photo_count` | integer | YES | 리뷰에 첨부한 사진 개수(선택) |
| `review_char_count` | integer | YES | 리뷰 본문 글자 수(선택) |
| `ai_review` | text | YES | Gemini 등으로 생성·저장한 AI 리뷰 초안 본문 |
| `ai_review_user_prompt` | text | YES | AI 리뷰 생성 시 모델에 함께 넘기는 추가 안내 문구(주문별) |
| `created_at` | timestamptz | NO | 생성 시각 |
| `updated_at` | timestamptz | NO | 수정 시각 |

#### FK 관계
- `orders.user_id` → `auth.users.id`
- `orders.platform_id` → `public.platforms.id`
- `orders.payment_method_id` → `public.payment_methods.id`
- `orders.buyer_account_id` → `public.buyer_accounts.id`
- `orders.purchase_info_template_id` → `public.purchase_info_templates.id`

---

### `public.platforms`

행 수: 6건 | RLS: 활성화 (조회: `user_id` IS NULL 또는 `auth.uid()` 일치, 추가·삭제: 본인 소유만, 색상 업데이트: 시스템/본인 행 가능)

| 컬럼 | 타입 | Nullable | 의미 |
|---|---|---|---|
| `id` | uuid | NO | PK |
| `user_id` | uuid | YES | NULL이면 시스템 기본값, `auth.uid()`면 사용자 추가값 |
| `name` | text | NO | 플랫폼 이름 (예: 쿠팡, 네이버) |
| `color` | text | NO | 플랫폼 표시 색상 (`#RRGGBB`) |
| `is_active` | boolean | NO | 활성 여부 (기본값 true) |

#### 제약 (이름 중복)
- 시스템 행(`user_id` IS NULL): 동일 `name`은 테이블당 최대 1행 (`platforms_system_name_unique`).
- 사용자 추가 행: 같은 `user_id` 안에서 `name` 중복 불가 (`platforms_user_name_unique`).
- (구버전) 전역 `UNIQUE(name)`만 있으면, 가입/초대 시 트리거가 같은 이름을 다시 넣을 때 `platforms_name_key` 충돌이 날 수 있음.

#### 샘플 데이터
| name | user_id | color |
|---|---|---|
| 네이버 | NULL (시스템) | `#16a34a` |
| 마켓컬리 | NULL (시스템) | `#64748b` |
| 무신사 | NULL (시스템) | `#64748b` |
| 올리브영 | NULL (시스템) | `#64748b` |
| 카카오 | NULL (시스템) | `#ca8a04` |
| 쿠팡 | NULL (시스템) | `#f97316` |

---

### `public.payment_methods`

행 수: 8건 | RLS: 활성화 (조회: `user_id` IS NULL 또는 `auth.uid()` 일치, 추가·삭제: 본인 소유만, 색상 업데이트: 시스템/본인 행 가능)

| 컬럼 | 타입 | Nullable | 의미 |
|---|---|---|---|
| `id` | uuid | NO | PK |
| `user_id` | uuid | YES | NULL이면 시스템 기본값, `auth.uid()`면 사용자 추가값 |
| `name` | text | NO | 결제 수단 이름 (예: 현금, 카카오페이) |
| `color` | text | NO | 결제 수단 표시 색상 (`#RRGGBB`) |
| `is_active` | boolean | NO | 활성 여부 (기본값 true) |

#### 제약 (이름 중복)
- 시스템 행: `payment_methods_system_name_unique` (`name`당 1행, `user_id` IS NULL).
- 사용자 추가 행: `payment_methods_user_name_unique` (`user_id`, `name`).

---

### `public.buyer_accounts`

행 수: 3건 | RLS: 활성화 (`auth.uid() = user_id` 소유자 정책)

| 컬럼 | 타입 | Nullable | 의미 |
|---|---|---|---|
| `id` | uuid | NO | PK |
| `user_id` | uuid | NO | 계정 소유 사용자 ID (`auth.users.id` FK) |
| `label` | text | NO | 구매자 계정 별칭 (예: 혜미, 석진) |
| `color` | text | NO | 구매 계정 표시 색상 (`#RRGGBB`) |

---

### `public.purchase_info_templates`

행 수: 사용자별 가변 | RLS: 활성화

| 컬럼 | 타입 | Nullable | 의미 |
|---|---|---|---|
| `id` | uuid | NO | PK |
| `user_id` | uuid | NO | 소유 사용자 (`auth.users.id` FK) |
| `title` | text | NO | 목록에서 구분용 제목 |
| `buyer_name` | text | YES | 구매자 |
| `recipient_name` | text | YES | 수취인 |
| `login_id` | text | YES | 아이디(쇼핑몰·서비스 로그인 등) |
| `phone` | text | YES | 연락처 |
| `address` | text | YES | 주소 |
| `bank_account_number` | text | YES | 은행계좌번호 |
| `account_holder` | text | YES | 예금주 |
| `created_at` | timestamptz | NO | 생성 시각 |
| `updated_at` | timestamptz | NO | 수정 시각 |

#### FK 관계
- `purchase_info_templates.user_id` → `auth.users.id`

---

### `public.user_ai_review_profiles`

행 수: 사용자당 0~1건 | RLS: 활성화 (`auth.uid() = user_id` 소유자 정책)

| 컬럼 | 타입 | Nullable | 의미 |
|---|---|---|---|
| `user_id` | uuid | NO | PK 겸 소유 사용자 (`auth.users.id` FK) |
| `gender` | text | YES | 성별 등(자유 입력) |
| `age_range` | text | YES | 나이대(예: 30대) |
| `region` | text | YES | 거주 지역(광역·시 단위 등 권장) |
| `occupation` | text | YES | 직업·생활 맥락 |
| `extra_context` | text | YES | 추가 설명(리뷰 톤 등) |
| `created_at` | timestamptz | NO | 생성 시각 |
| `updated_at` | timestamptz | NO | 수정 시각 |

#### FK 관계
- `user_ai_review_profiles.user_id` → `auth.users.id`

---

### `public.user_item_settings`

행 수: 0건 | RLS: 활성화 (`auth.uid() = user_id` 소유자 정책, upsert 대비 update 포함)

| 컬럼 | 타입 | Nullable | 의미 |
|---|---|---|---|
| `user_id` | uuid | NO | 사용자 ID (PK 구성요소) |
| `target_id` | uuid | NO | 숨김 처리된 항목의 ID (PK 구성요소) |
| `item_type` | text | NO | 항목 유형 (`"platform"` 또는 `"payment_method"`) |
| `is_hidden` | boolean | YES | true이면 해당 사용자에게 해당 항목을 숨김 처리 (기본값 true) |

#### 용도
- `platforms` / `payment_methods`의 시스템 기본값(user_id IS NULL)을 특정 사용자에게 숨기는 용도
- 사용자가 직접 추가한 항목은 DELETE, 시스템 항목은 이 테이블에 `is_hidden: true`로 기록

---

### `public.users`

행 수: `auth.users`와 동일(가입·백필 후) | RLS: 활성화 (`auth.uid() = user_id`로 조회·본인 행의 `name`만 수정; `email`은 DB 권한상 클라이언트에서 갱신 불가)

| 컬럼 | 타입 | Nullable | 의미 |
|---|---|---|---|
| `user_id` | uuid | NO | PK, `auth.users.id` FK (삭제 시 CASCADE) |
| `name` | text | NO | 표시 이름. 신규 가입 시 `raw_user_meta_data`(full_name/name)·이메일 로컬파트 순으로 채움(없으면 빈 문자열) |
| `email` | text | YES | `auth.users.email` 복제(조회·조인용). 이메일 변경은 Supabase Auth에서 처리 |

#### 동작
- 트리거 `on_auth_user_created_sync_public_users`: `auth.users`에 INSERT되면 `public.users`에 `user_id`, `name`, `email`을 넣고 `on conflict do nothing`으로 한 행 추가.
- 마이그레이션 `20260419200000` 시점에 이미 있던 `auth.users`는 `public.users`로 일괄 INSERT(백필); 이후 `20260419210000`에서 `email` 컬럼 백필.

#### FK 관계
- `public.users.user_id` → `auth.users.id`

---

## 3) 데이터 조회 패턴

### orders 목록 조회 (join 포함)
```typescript
supabase
  .from("orders")
  .select("*, platforms(id, name, color), payment_methods(id, name, color), buyer_accounts(id, label, color), purchase_info_templates(*)")
  .order("purchase_date", { ascending: false })
```

### 마스터 데이터 조회 (숨김 항목 제외)
`src/lib/master-data.ts`의 `fetchMasterData(supabase, userId)` 사용

---

## 4) 참고
- `public.orders`, `public.purchase_info_templates`, `public.buyer_accounts`, `public.platforms`, `public.payment_methods`, `public.user_ai_review_profiles`, `public.user_item_settings`, `public.users`는 RLS가 활성화되어 있습니다.
- `platforms` / `payment_methods`는 시스템 기본 행(`user_id` IS NULL)을 모든 인증 사용자가 조회할 수 있습니다. INSERT·DELETE는 `user_id = auth.uid()`인 행만 가능하고, UPDATE(색상)는 시스템/본인 행 모두 허용됩니다.
- 쓰기 시 FK 컬럼(`platform_id`, `payment_method_id`, `buyer_account_id`)을 사용합니다.
- AI 리뷰 생성은 Supabase Edge Function `generate-ai-review`에서 Gemini를 호출하고, 완료 시 `orders.ai_review`를 갱신합니다. 배포 후 프로젝트 시크릿에 `GEMINI_API_KEY`를 설정하고 `supabase functions deploy generate-ai-review`로 배포해야 합니다. 선택 환경 변수: `GEMINI_MODEL`(기본 `gemini-2.5-flash-lite`, 무료 티 권장). 값은 **모델 id만**(`gemini-2.5-flash`, `gemini-2.0-flash` 등). `models/` 접두어는 Edge에서 제거합니다. `gemini-1.5-flash` 등 1.5 계열은 404가 나는 경우가 많아 `gemini-2.5-flash-lite`로 치환합니다. 신규 프로젝트 JWT(ES256)와의 호환을 위해 `supabase/config.toml`에서 이 함수는 `verify_jwt=false`이며, 함수 코드에서 `auth.getUser()`로 사용자를 검증합니다.
