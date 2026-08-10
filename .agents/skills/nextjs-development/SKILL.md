---
name: nextjs-development
description: 이 저장소의 Next.js 16 App Router 라우트, 서버·클라이언트 컴포넌트, 서버 라우트, 설정, 빌드 동작을 변경할 때 사용한다.
---

# Next.js 개발

## 작업 전

1. `AGENTS.md`의 프로젝트 개요·주요 디렉터리에서 해당 라우트와 컴포넌트 책임을 확인합니다.
2. 현재 설치된 Next.js 버전에 맞는 관련 문서를 `node_modules/next/dist/docs/`에서 찾습니다.
3. 코드를 작성하기 전에 찾은 문서를 읽고, 변경된 API와 폐기 예정 API를 확인합니다. 학습 데이터의 기존 Next.js 관례를 그대로 가정하지 않습니다.
4. App Router 구조, 브라우저 Supabase 세션, 서버 라우트, Docker standalone 빌드처럼 `AGENTS.md`에 정리된 실행 방식을 유지합니다.

## 구현 원칙

- 기존 `src/app`, `src/components/pages`, `src/components`, `src/lib`, `src/types` 책임을 먼저 재사용합니다.
- 서버·클라이언트 경계를 바꾸기 전에 해당 데이터 흐름과 인증 흐름을 확인합니다.
- 페이지를 새로 만들기 전에 기존 라우트와 공통 레이아웃으로 조합할 수 있는지 확인합니다.
- Next.js 동작과 무관한 UI 세부사항은 `review-manager-ui` 스킬의 규칙을 따릅니다.

## 검증

- 변경 후 `npm run lint`와 관련 테스트를 실행합니다.
- 라우트·서버 코드·`next.config`·의존성·Docker 실행 방식에 영향을 주면 `npm run build`를 실행합니다.
- 빌드가 외부 환경이나 환경변수 때문에 실패하면 코드 오류와 환경 문제를 구분해 기록합니다.
