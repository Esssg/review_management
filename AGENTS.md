<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Reuse Existing First

`docs/project_overview.md`를 먼저 참고해 프로젝트 구조와 기존 책임 분리를 확인한 뒤 작업한다.

Core rules:
- 새 함수/새 파일을 만들기 전에, 같은 목적의 기존 코드가 있는지 먼저 찾는다.
- 기존 컴포넌트/유틸/타입을 확장하거나 조합해 해결 가능한 경우, 신규 생성보다 재사용을 우선한다.
- 중복 로직이 생기면 새 구현 대신 기존 공통 로직으로 통합한다.

Work order:
1. `docs/project_overview.md`에서 관련 디렉터리와 역할을 확인한다.
2. `src/components`, `src/lib`, `src/types`, `supabase`에서 동일/유사 책임 코드를 탐색한다.
3. 재사용 가능 코드를 찾으면 최소 변경으로 연결한다.
4. 아래 조건을 만족할 때만 새 함수/파일을 만든다.

New files or functions are allowed only when:
- 기존 코드가 요구사항을 충족하지 못하고 확장 시 부작용이 큰 경우
- 책임 분리가 명확해져 유지보수성이 실제로 개선되는 경우
- 생성 이유와 기존 코드 재사용이 어려운 이유를 작업 설명에 명시한 경우

Examples:
- 주문 목록 표시 변경: `src/components/orders`의 기존 테이블/셀 구조를 우선 수정한다.
- Supabase 쿼리 확장: 기존 쿼리 유틸/타입 정의를 확장하고, 동일 로직의 신규 파일 복제를 피한다.

## 6. Project Documentation and Comments

When working in this repository:
- 코드를 만들 때는 항상 비개발자가 알아들을 수 있게 한국어 주석을 작성해야 한다.
- 코드를 짜기 전 `docs/project_overview.md`를 확인해서 중복코드가 발생하지 않도록 신경써야 한다.
- 코드 수정사항이 생기면 `docs/project_overview.md`에 업데이트해야 한다.
- 임시 파일이나 1회성 검증 산출물은 작업 종료 전에 삭제하고, 저장소에는 유지할 필요가 있는 산출물만 남긴다.

Temporary files to delete include:
- Scratch notes such as `tmp_*.md` or `scratch_*`
- Temporary query dumps or log files
- One-off verification output files

## 7. DB Guide Sync

MCP(Supabase)를 사용하여 데이터베이스 스키마를 변경할 때, 동일한 작업 컨텍스트 내에서 반드시 `docs/guide_db.md` 파일을 최신 상태로 업데이트해야 한다.

This rule applies when MCP changes:
- Tables: create, delete, rename
- Columns: add, delete, rename, type/default/nullability changes
- Constraints: Primary Key, Foreign Key, Unique, Index changes
- Schema: any migration that affects the `public` schema structure

Required actions:
1. 스키마 변경 직후 MCP 도구를 다시 호출하여 변경된 전체 스키마 정보를 정확히 읽어온다.
2. 읽어온 정보를 바탕으로 `docs/guide_db.md`를 수정하여 최종 스키마 상태를 반영한다.
3. 문서 내 샘플 로우가 있고 스키마 변경의 영향을 받는다면 실제 데이터 구조에 맞게 수정한다.
4. 응답 마지막에 `docs/guide_db.md`가 업데이트되었음을 사용자에게 명시적으로 알린다.

Scope:
- Focus on user-defined tables in the `public` schema.
- Unless explicitly requested, exclude Supabase internal schemas such as `auth` and `storage`.

## 8. Web and App UI Consistency

이 프로젝트는 웹과 앱 모두에 배포되므로, 화면 설계/수정 시 두 환경을 항상 함께 고려한다.

Core rules:
- UI 변경 시 데스크톱 웹, 모바일 웹, 앱(WebView 포함)에서의 사용성을 함께 점검한다.
- 화면 구조는 반응형을 기본으로 설계하고, 작은 화면에서도 주요 동작이 가려지지 않게 구성한다.
- 터치 중심 환경을 고려해 버튼 크기, 간격, 스크롤 동선, 고정 영역(헤더/푸터) 충돌을 확인한다.
- 웹 전용 상호작용(hover, 우클릭, 큰 화면 전제 레이아웃)에 의존하지 않는다.

Implementation checklist:
1. 새 화면/컴포넌트 추가 시 모바일 우선 레이아웃을 먼저 검토한다.
2. 화면 깨짐 가능성이 있는 고정 폭, 과도한 가로 배치, 절대 위치 사용을 최소화한다.
3. 주요 액션(조회/저장/이동)이 작은 화면에서도 한 손 조작 가능한 위치와 흐름인지 확인한다.
4. 필요 시 브레이크포인트별 UI 차이는 허용하되, 기능/정보의 의미는 웹과 앱에서 일관되게 유지한다.
