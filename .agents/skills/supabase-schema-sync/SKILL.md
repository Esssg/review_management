---
name: supabase-schema-sync
description: Supabase MCP 또는 마이그레이션으로 public 스키마의 테이블, 컬럼, 제약조건, 인덱스를 변경할 때 사용한다. 변경 후 전체 스키마를 다시 확인하고 이 스킬의 database-guide 참조를 동기화한다.
---

# Supabase 스키마 동기화

## 적용 범위

다음 변경에 적용합니다.

- `public` 테이블 생성·삭제·이름 변경
- 컬럼 추가·삭제·이름·타입·기본값·null 허용 여부 변경
- Primary Key, Foreign Key, Unique, Index 변경
- `public` 스키마 구조에 영향을 주는 마이그레이션

`auth`, `storage` 등 Supabase 내부 스키마는 사용자가 명시한 경우에만 다룹니다.

## 공개 스키마 경계 (필수)

기준 Supabase 프로젝트의 `public` 스키마에는 이 저장소와 무관한 다른 프로젝트의 테이블도 함께 있을 수 있습니다.

- `RLS`가 활성화된 테이블은 이 프로젝트 소유로 판단합니다.
- `RLS`가 비활성화된 `public` 테이블은 다른 프로젝트 소유로 판단하며, 이름을 알고 있거나 MCP에서 조회되더라도 절대 조회·수정·삭제·DDL·마이그레이션·시드 대상에 포함하지 않습니다.
- 이 저장소의 현재 데이터·스키마 작업 허용 목록은 `users`, `platforms`, `payment_methods`, `buyer_accounts`, `purchase_info_templates`, `user_ai_review_profiles`, `user_item_settings`, `user_preferences`, `user_order_drafts`, `saved_order_views`, `orders`, `bank_account`, `bank_account_deposit`, `platform_accounts`, `crawl_orders`입니다.
- `RLS`가 활성화되어도 현재 코드와 마이그레이션에서 사용하지 않는 `coupang_payment_method_mappings` 같은 테이블은 명시적인 사용자 요청 없이는 변경하지 않습니다. `RLS` 활성화 여부는 소유권 경계이고, 허용 목록은 실제 작업 범위입니다.
- 작업 전 `public` 테이블의 `RLS` 상태는 메타데이터로 읽기 전용 확인할 수 있지만, 실제 작업 대상은 위 허용 목록으로 제한합니다. 대상이 허용 목록에 없거나 `RLS` 상태가 불명확하면 SQL·MCP 변경 호출·마이그레이션 작성을 진행하지 말고 확인을 요청합니다.

## 작업 절차

1. `AGENTS.md`의 프로젝트·DB 공통 맥락, 이 스킬의 `references/database-guide.md`, 기존 마이그레이션과 타입 정의를 먼저 확인합니다.
2. 동일한 테이블·컬럼·제약조건을 만드는 기존 마이그레이션이나 쿼리가 있는지 찾습니다.
3. 사용 가능한 Supabase MCP 도구 또는 저장소의 마이그레이션 방식으로 스키마를 변경합니다.
4. 변경 직후 MCP 도구를 다시 호출해 `public`의 RLS 상태를 확인하고, 허용 목록에 있는 변경 대상 테이블의 최종 구조만 읽습니다.
5. 읽어온 최종 구조를 기준으로 `references/database-guide.md`의 허용 목록과 해당 테이블의 컬럼, 제약조건, 인덱스, 샘플 로우를 갱신합니다. 다른 프로젝트 테이블의 구조나 데이터를 이 가이드에 추가하지 않습니다.
6. 애플리케이션 타입 계약이 바뀌었으면 프로젝트의 타입 생성 절차와 관련 코드를 함께 갱신합니다.
7. 스키마 변경으로 프로젝트 동작이나 책임이 바뀌면 `AGENTS.md`의 관련 프로젝트 개요도 갱신합니다.

## 검증과 보고

- 최종 스키마를 다시 읽어 문서와 실제 구조가 일치하는지 확인합니다.
- 관련 린트·테스트·타입 생성 또는 빌드를 실행합니다.
- 최종 응답에 `references/database-guide.md`를 업데이트했다는 사실을 명시합니다.
