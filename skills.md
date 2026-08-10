# Codex 스킬 목록

이 파일은 이 저장소에서 사용하는 스킬의 인덱스입니다. 공통 프로젝트 개요와 DB 핵심 규칙은 `AGENTS.md`에 두고, 작업별 절차는 각 스킬 디렉터리의 `SKILL.md`에 둡니다. 상세 `public` 스키마는 Supabase 스킬의 참조 파일에 둡니다.

| 스킬 | 적용 시점 | 실제 지침 |
|---|---|---|
| 일반 개발 | 기능 추가, 버그 수정, 리팩터링 | `.agents/skills/review-manager-development/SKILL.md` |
| Next.js 개발 | Next.js 라우트·컴포넌트·설정·빌드 변경 | `.agents/skills/nextjs-development/SKILL.md` |
| UI·반응형 | 화면·컴포넌트·스타일 변경 | `.agents/skills/review-manager-ui/SKILL.md` |
| Supabase 스키마 동기화 | `public` 스키마 변경 | `.agents/skills/supabase-schema-sync/SKILL.md` |

Supabase 스키마의 테이블·컬럼·FK·제약조건·인덱스·샘플 데이터·조회 패턴은 `.agents/skills/supabase-schema-sync/references/database-guide.md`에서 확인합니다.

> **Supabase 공개 스키마 경계:** `public`에는 다른 프로젝트의 테이블도 함께 존재합니다. `RLS`가 꺼진 테이블은 다른 프로젝트 소유이므로 절대 건드리지 않으며, 이 저장소의 실제 사용 테이블 허용 목록과 작업 절차는 `AGENTS.md`와 `supabase-schema-sync` 스킬의 공개 스키마 경계를 따릅니다.
