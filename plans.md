# 앱 빌드 지원 제거 계획

작성일: 2026-08-07

기존 `plans.md`의 자동추천 탭 계획은 폐기하고, 현재 요청에 맞는 계획으로 교체한다.

## 1. 목표와 완료 기준

이 저장소를 Capacitor 기반 Android/iOS 앱을 빌드하지 않는 웹 전용 Next.js 프로젝트로 정리한다.

완료 기준:

- Capacitor, Android/iOS 네이티브 프로젝트, APK 빌드·동기화 명령이 저장소의 실행 경로와 문서에서 제거된다.
- `BUILD_TARGET=apk`, `output: "export"` 등 앱 전용 Next.js 빌드 분기가 제거되고, 현재 웹 빌드 및 Docker 빌드는 유지된다.
- 앱 플랫폼 감지, Android 하드웨어 뒤로가기, 앱 전용 화면 분기, 앱 전용 클립보드 처리가 제거된다.
- 웹의 주문·대시보드·자동추천·설정 기능은 기존 동작을 유지한다.
- 작업 종료 전에 `AGENTS.md`의 앱/WebView 전제를 웹 전용 지침으로 반드시 갱신한다.
- `npm run lint`와 웹용 `npm run build`가 통과한다.
- 소스·설정·문서 검색에서 저장소가 더 이상 앱 빌드를 전제로 하지 않는다.

## 2. 현재 확인된 앱 관련 범위

- `package.json`: `cap:*` 및 APK 빌드 스크립트, `@capacitor/*`, `patch-package` 의존성.
- `next.config.ts`: `BUILD_TARGET=apk` 정적 export 분기.
- `capacitor.config.ts`: Capacitor 앱 ID, 이름, `out/` WebView 산출물 설정.
- `android/`: 추적 중인 Capacitor Android 프로젝트 58개 파일.
- `patches/@capacitor+android+7.6.2.patch`: Android 빌드용 패치.
- `src/components/native/capacitor-android-back-handler.tsx`: Android 하드웨어 뒤로가기 및 앱 종료 확인.
- `src/lib/order-detail-leave-guard.ts`: 위 Android 뒤로가기와 연결된 주문 상세 이탈 처리.
- `src/lib/copy-to-clipboard.ts`: Capacitor Clipboard 우선 처리.
- `src/app/layout.tsx`, `src/components/pages/dashboard-page.tsx`, `src/components/orders/orders-dashboard.tsx`, `src/components/orders/order-detail-form.tsx`, `src/components/ui/entity-select.tsx`: Capacitor/네이티브 전용 분기.
- `src/components/pages/crawl-orders-page.tsx`, `src/components/orders/orders-table.tsx`, `src/components/settings/settings-panel.tsx` 및 관련 주석·오류 문구: 앱 전제를 설명하는 문구.
- `docs/project_overview.md`, `AGENTS.md`, `.env.example`, `Dockerfile`, `.gitignore`: 앱 빌드·WebView·Android/iOS를 설명하거나 지원하는 문서·설정.
- iOS 네이티브 디렉터리는 현재 추적 목록에 없다. 다만 iOS 관련 Capacitor 의존성·명령·문서는 제거 대상이다.

## 3. 실행 계획

### 3-1. 삭제 범위와 보존 범위 확정

- 아래 답변으로 확정된 범위를 반영하고, 추가 확인이 필요한 항목만 작업 전에 확인한다.
- 프로젝트 내부의 앱 관련 추적 파일과 로컬 산출물은 삭제 대상으로 본다. 단, 모바일 브라우저 기능은 보존한다.
- 웹 기능, Supabase 연동, 데이터베이스 마이그레이션은 앱 제거 자체와 무관하므로 변경하지 않는다.

검증: 삭제 예정 파일과 보존할 웹 기능의 경계가 계획서에 명시되어 있는지 확인한다.

### 3-2. 네이티브 빌드 도구 제거

- `package.json`에서 `cap:sync`, `cap:open:*`, `cap:apk:*` 스크립트를 제거한다.
- `@capacitor/android`, `@capacitor/app`, `@capacitor/clipboard`, `@capacitor/core`, `@capacitor/ios`, `@capacitor/cli`를 제거한다.
- 더 이상 패치를 적용할 대상이 없으므로 `postinstall`의 `patch-package`, `patch-package` 개발 의존성, `patches/`를 제거한다.
- `package-lock.json`은 `package.json`과 함께 재생성·검증한다.
- `capacitor.config.ts`, 추적된 `android/`, Capacitor Android 패치를 삭제한다.
- `.gitignore`에서 Android 빌드 산출물·키스토어 전용 규칙과 앱 전용 `/out/` 무시 규칙을 제거한다. 프로젝트 안에 남아 있는 해당 산출물도 삭제한다.

검증: `package.json`과 lockfile에 직접 의존하는 Capacitor 패키지·앱 명령이 남지 않고, `npm ci`가 통과한다.

### 3-3. 앱 전용 런타임 코드 정리

- `src/app/layout.tsx`에서 Android 뒤로가기 컴포넌트 import와 렌더링을 제거한다.
- `src/components/native/capacitor-android-back-handler.tsx`를 삭제한다.
- `src/components/orders/order-detail-form.tsx`에서 Android 뒤로가기 등록과 `order-detail-leave-guard` 연결을 제거한다. 브라우저의 `beforeunload` 및 링크 이탈 시 변경사항 보호는 웹 기능이므로 유지한다.
- `src/lib/order-detail-leave-guard.ts`는 남은 참조가 없을 때 삭제한다.
- `src/lib/copy-to-clipboard.ts`에서 Capacitor Clipboard 분기를 제거하고, 브라우저 Clipboard API와 기존 `execCommand` fallback만 유지한다.
- `dashboard-page.tsx`, `orders-dashboard.tsx`, `entity-select.tsx`, `order-detail-form.tsx`의 `isNative`/`isNativeApp` 상태·props·조건부 렌더링을 제거하고 웹 경로를 단일 경로로 만든다.
  - 대시보드 엑셀 내보내기, 월별 표, 선택 입력 UI가 웹에서 기존처럼 표시되는지 확인한다.
- 앱 재빌드나 `cap sync`를 안내하는 오류 문구와 앱/WebView 전제 주석을 브라우저 기준 문구로 바꾼다.
- 모바일 웹에서 실제로 사용되는 `safe-area-inset`, `viewportFit`, 반응형·터치 UI는 유지한다. WebView나 Capacitor만을 설명하는 주석·분기만 제거한다.

검증: `rg`로 `Capacitor`, `isNative`, Android 하드웨어 뒤로가기, `cap sync` 참조를 검색하고 의도된 문서 항목 외에는 결과가 없는지 확인한다.

### 3-4. 웹 전용 설정과 문서 갱신

- `next.config.ts`에서 APK 정적 export 분기를 제거하고 Docker `standalone` 분기와 일반 웹 개발·빌드 설정을 유지한다.
- `Dockerfile`에서 Capacitor 패치 복사와 관련 주석을 제거하고 일반 `npm ci` 흐름으로 정리한다.
- `.env.example`에서 “웹과 Capacitor 앱” 표현을 웹 기준으로 바꾼다.
- `docs/project_overview.md`에서 Capacitor/Android/iOS/APK/WebView 전용 설명·디렉터리·명령·설치 가이드를 제거하고, 웹 빌드와 Docker 실행 방법을 현재 코드에 맞게 다시 정리한다.
- `AGENTS.md`의 “웹과 앱” 전제 및 WebView 포함 점검 지침을 웹 전용 지침으로 수정한다. 데스크톱 웹과 모바일 브라우저의 반응형 점검 규칙은 필요한 범위에서 유지한다. 이 문서 갱신은 작업 종료 전 필수 단계다.
- `DESIGN.md`는 앱을 전제로 한 내용이 실제로 있는지 확인하되, 단순히 모바일 웹에도 유효한 디자인 규칙은 삭제하지 않는다.
- 변경된 코드와 문서에는 프로젝트 규칙에 따라 비개발자도 이해할 수 있는 한국어 설명을 유지한다.

검증: 문서의 실행 명령이 실제 `package.json` 스크립트와 일치하고, 웹 전용 프로젝트 설명에 APK·Capacitor 절차가 남지 않는다.

### 3-5. 최종 검증

- 의존성 설치 후 `npm run lint` 실행.
- 필요한 환경변수를 준비한 상태에서 `npm run build` 실행.
- `docker compose`의 웹 빌드 설정이 `BUILD_TARGET=docker`로 정상 동작하는지 확인한다.
- 주요 웹 경로(`/`, `/dashboard`, `/menu-4`, `/orders/new`, `/settings`)의 로드와 주문 상세 이탈 보호를 확인한다.
- 앱 전용 참조를 다시 검색한다. 단, transitive dependency 이름에 포함된 `android` 같은 플랫폼 문자열은 앱 지원 잔재로 간주하지 않는다.
- `git diff`로 웹 기능·DB 파일·무관한 기존 코드를 건드리지 않았는지 확인한다.

## 4. 변경 예정 파일 요약

삭제 후보:

- `android/`
- `capacitor.config.ts`
- `patches/@capacitor+android+7.6.2.patch`
- `src/components/native/capacitor-android-back-handler.tsx`
- `src/lib/order-detail-leave-guard.ts`

수정 후보:

- `package.json`, `package-lock.json`, `next.config.ts`, `Dockerfile`, `.gitignore`, `.env.example`
- `src/app/layout.tsx`
- `src/components/pages/dashboard-page.tsx`
- `src/components/orders/orders-dashboard.tsx`
- `src/components/orders/order-detail-form.tsx`
- `src/components/ui/entity-select.tsx`
- `src/lib/copy-to-clipboard.ts`
- `src/components/pages/crawl-orders-page.tsx`
- `src/components/orders/orders-table.tsx`
- `src/components/settings/settings-panel.tsx`
- `docs/project_overview.md`, `AGENTS.md` 및 필요 시 `DESIGN.md`
- `docs/guide_db.md`의 모바일 앱 전제 표현
- 앱 전제를 설명하는 주석만 수정할 `supabase/migrations/20260418260000_orders_ai_review_user_prompt.sql`, `supabase/migrations/20260419200000_public_users_auth_sync.sql`, `supabase/migrations/20260419210000_public_users_email.sql`

DB 스키마 변경: 없음. Supabase MCP 호출은 하지 않으며, 모바일 앱 전제 표현을 제거하기 위해 `docs/guide_db.md`와 기존 마이그레이션의 주석만 수정한다.

## 5. 확인 사항과 답변 반영

### 답변으로 확정된 범위

1. **모바일 브라우저 지원 범위**
   - 앱만 없애고 모바일 브라우저의 반응형 화면·하단 메뉴·터치 동작은 유지할지,
   - 아니면 모바일 전용 UI까지 데스크톱 웹 중심으로 단순화할지 결정이 필요하다.
   - A: 앱만 없애고 모바일 브라우저의 반응형 화면 동작은 유지함.

   반영: 모바일 브라우저용 반응형·터치 UI는 유지하고, Capacitor 플랫폼 감지와 네이티브 전용 분기만 제거한다.

2. **추적되지 않은 로컬 Android 파일 처리**
   현재 `android/` 아래에 Git에서 무시되는 `.gradle`, `.idea`, `build`, 정적 assets, `local.properties`, `keystore.properties`, `keystore/review-manager.jks`가 확인되었다.
   - 저장소에서 추적 중인 Android 파일만 삭제할지,
   - 위 로컬 산출물과 서명 키까지 이 컴퓨터에서 삭제할지,
   - 키와 산출물을 별도 보관한 뒤 삭제할지 결정이 필요하다.
   비밀번호나 키 내용은 출력·커밋하지 않는다.

   - A: 모든 어플리케이션과 관련된 파일은 지운다.

   반영: 저장소 추적 파일뿐 아니라 이 프로젝트 내부의 앱 관련 로컬 산출물·서명 파일도 삭제 대상으로 계획한다.

3. **이미 배포·설치된 APK의 처리**
   저장소 정리만 할지, 기존 APK 파일·기기에 설치된 앱·앱 데이터까지 중단/삭제할지는 이 저장소 밖의 작업이다. 후자까지 원하면 별도 운영 작업으로 범위를 확정해야 한다.

   - A: 정리 가능한 부분은 모두 삭제.

   반영: 현재 프로젝트 디렉터리 안에서 삭제 가능한 APK·빌드 산출물은 삭제하되, 외부 기기·배포 서비스·별도 저장소의 앱은 이 작업에서 다루지 않는다.

4. **크롤링 API의 외부 CORS 설정**
   이 저장소는 크롤링 API를 호출하는 웹 클라이언트만 포함하고 API 서버는 포함하지 않는다. API 서버의 Android/iOS origin 허용 목록까지 제거할지는 외부 서버 담당 범위이며, 필요하면 별도 변경으로 진행한다.

   - A: 이 프로젝트 내에서 정리 가능한 부분은 모두 정리한다.

   반영: 이 저장소의 API URL·주석·문서에 남은 앱 origin 설명은 웹 기준으로 정리한다. 외부 크롤링 API 서버의 CORS 설정은 이 저장소에 없으므로 변경하지 않는다.

5. **웹 배포 방식**
   현재 일반 `next build`와 Docker standalone 실행 경로가 있다. APK용 정적 export는 제거하되, 별도 정적 웹 호스팅(`out/`) 지원까지 새로 정리할지 여부는 확인이 필요하다. 답변 전에는 현재 일반 웹 빌드와 Docker 경로만 보존하는 범위로 계획한다.

   - A: 이 프로젝트 내에서 정리 가능한 부분은 모두 정리한다.

   반영: 앱 전용 정적 export와 `out/` 산출물은 정리 대상으로 두고, 일반 웹 빌드와 Docker 경로만 유지한다.

### 추가 답변 반영

6. **모바일 웹의 safe-area 설정**
   모바일 브라우저 대응을 유지하기로 했으므로, 현재 `env(safe-area-inset-bottom)`과 `viewportFit: "cover"`가 iOS Safari 등 모바일 브라우저에서도 유효할 수 있다.
   - A: 웹에서 영향도가 없는 부분은 삭제하고 웹에서 영향도가 있으면 삭제하지 않는다.

   반영: `safe-area-inset`과 `viewportFit: "cover"`는 모바일 브라우저의 하단 안전 영역에 영향을 줄 수 있으므로 유지한다. Capacitor/WebView 전용 주석과 플랫폼 분기만 제거한다.

7. **Chrome 확장 프로그램 범위**
   `public/downloads/review-manager-chrome-extension-v0.1.0.zip`과 `src/components/pages/chrome-extension-install-guide.tsx`는 Capacitor 모바일 앱이 아니라 Chrome 확장 프로그램 관련 파일이다.
   - A: 크롬 확장 프로그램은 삭제하면 안 됨.

   반영: `public/downloads/review-manager-chrome-extension-v0.1.0.zip`과 `src/components/pages/chrome-extension-install-guide.tsx` 및 관련 기능은 보존한다.

8. **과거 Supabase 마이그레이션의 ‘앱’ 주석**
   일부 이미 작성된 `supabase/migrations/*.sql` 주석에 “앱용” 또는 “앱에서”라는 표현이 있다. 이 주석은 모바일 빌드 설정이 아니라 과거 스키마 변경 기록이다.
   - A: 주석 수정.

   반영: 아래 세 마이그레이션의 모바일 앱 전제 표현만 웹 애플리케이션 기준으로 수정하고, SQL·스키마·마이그레이션 파일명은 변경하지 않는다.
   DB 스키마 변경은 어느 쪽이든 발생시키지 않는다.

9. **정적 웹 호스팅 지원**
   현재 `docs/project_overview.md`에는 `out/`을 Nginx·S3 등에 배포하는 설명이 있지만, 일반 `next build`는 현재 `out/`을 만들지 않고 APK 빌드 분기에서만 정적 export를 사용한다.
   - A: 제거.

   반영: `out/` 정적 호스팅 설명과 웹 전용 정적 export 지원을 추가하지 않고, 일반 `next build`와 Docker/Node 배포만 유지한다.

## 6. 작업 종료 조건

모든 확인 사항을 반영한 뒤 삭제 작업을 실행하고, 최종 응답에는 삭제한 네이티브 범위·보존한 모바일 웹 및 Chrome 확장 프로그램 범위·검증 결과를 명시한다.
