# Review Manager 프로젝트 정리

## 프로젝트 개요
- 리뷰/주문 운영 데이터를 관리하기 위한 Next.js 기반 웹 애플리케이션입니다.
- 프론트엔드는 Next.js App Router 구조를 사용하고, 백엔드는 Supabase(PostgreSQL/Auth)를 활용합니다.
- 주문 데이터의 등록/조회/상태 관리를 중심으로 동작합니다.
- 자동 추천(`/menu-4`)은 `crawl_orders`의 처리 대기 행을 `purchase_date` 내림차순으로 보여주고, 검수해 `orders`로 저장하거나 목록 행 hover 시 나타나는 삭제 버튼으로 삭제 상태로 바꾸는 크롤링 주문 확인 화면입니다. 새로고침 버튼은 사용자 `platform_accounts`의 크롤링 상태를 확인하고, 실행 중이 아니면 외부 크롤링 서버의 계정별 쿠팡 크롤링 API를 호출합니다.
- **Capacitor 내장형**: `next build`로 정적 사이트(`out/`)를 만들고, APK 안 WebView에서 UI를 로드합니다. 데이터·로그인은 **온라인 Supabase**와 통신합니다(맥에서 Next를 켜둘 필요 없음).

## 기술 스택
- 프레임워크: `next@16`, `react@19`, `typescript` — `output: "export"` 정적 배포
- UI: `@base-ui/react`, `shadcn`, `lucide-react`, `tailwindcss@4`
- 데이터/인증: `@supabase/supabase-js`(브라우저 `localStorage` 세션)
- 네이티브 셸: Capacitor 7, `webDir: "out"`([`capacitor.config.ts`](../capacitor.config.ts)). `patches/@capacitor+android+7.6.2.patch`로 API 35 `android.jar` 오류 시에도 **compileSdk 34** 빌드가 되도록 보완합니다(`npm install` 시 `patch-package` 적용).
- 품질 관리: `eslint`

## 주요 디렉터리
- `src/app`: 라우팅 및 페이지 구성(대부분 클라이언트에서 Supabase 조회)
- `src/components/pages`: 내장형용 클라이언트 페이지(홈·로그인·대시보드·주문 상세 등)
- `src/components`: 도메인 UI (`orders`, `auth`, `ui`)
- `src/lib`: 공통 유틸·`supabase/client.ts`
- `src/types`: 타입 정의 및 DB 타입 파일
- `supabase/migrations`: DB 마이그레이션
- `supabase/seed_orders_from_ledger.sql`: 주문 시드 데이터 스크립트
- `out/`: `next build` 후 생성되는 정적 산출물(Capacitor가 이 디렉터리를 앱에 복사)
- `android/`: Capacitor Android 네이티브 프로젝트

## 실행/개발 스크립트
- `npm run dev` / `npm run dev:lan`: 로컬 개발(정적 export와 동일 라우트, HMR)
- `npm run build`: 정적 사이트를 `out/`에 생성
- `npm run lint`: 린트 검사
- `npm run gen:types`: Supabase public 스키마 타입 생성
- `npm run cap:sync`: `out/`을 Android(및 iOS) 프로젝트에 반영
- `npm run cap:open:android` / `cap:open:ios`: 네이티브 IDE 열기
- `npm run cap:apk:debug`: `next build` → `cap sync android` → 디버그 APK 빌드. 산출물: `android/app/build/outputs/apk/debug/app-debug.apk`
- `npm run cap:apk:release`: `next build` → `cap sync android` → 서명된 릴리스 APK 빌드. `android/keystore.properties`가 있어야 자동 서명됨. 산출물: `android/app/build/outputs/apk/release/app-release.apk`

## 내장형 APK 빌드 요약

1. **`.env.local`**(또는 빌드 환경)에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 설정. 값은 **빌드 시** JS 번들에 박힙니다.
2. **`npm run cap:apk:debug`** 한 번이면 정적 빌드·동기화·Gradle까지 수행됩니다.
3. 생성된 **`app-debug.apk`**를 기기에 전달해 설치합니다.

### 휴대폰에 USB로 디버그 APK 설치 (ADB)

여러 기기가 연결되어 있거나 특정 기기만 지정할 때는 `-s <시리얼>`을 씁니다. 시리얼은 `adb devices`로 확인합니다.

```bash
adb -s R3CWB0JM3NY install -r -t "/Users/2sssg/workspace2/review_manager/android/app/build/outputs/apk/debug/app-debug.apk"
```

- `-r`: 기존 앱이 있으면 재설치(데이터 유지)
- `-t`: 테스트 APK(디버그 서명 등) 설치 허용

### 서명된 릴리스 APK 만들기 (파일 전송 설치용)

디버그 APK는 Play Protect·삼성 Auto Blocker 등이 차단할 수 있어, 파일 전송으로 설치하려면 내 키스토어로 서명된 release APK가 필요합니다.

1. 키스토어 1회 생성(비밀번호는 직접 입력):

```bash
keytool -genkeypair -v \
  -keystore android/keystore/review-manager.jks \
  -alias reviewmanager \
  -keyalg RSA -keysize 2048 -validity 10000
```

2. `android/keystore.properties.example`을 `android/keystore.properties`로 복사한 뒤 실제 비밀번호를 채움. 두 파일 모두 `.gitignore`로 커밋이 막혀 있음. `.jks`와 `keystore.properties`는 **저장소 외부에 별도 백업** 필수(분실 시 동일 패키지의 업데이트가 영원히 불가).

3. 빌드:

```bash
npm run cap:apk:release
```

산출물: `android/app/build/outputs/apk/release/app-release.apk` — 이 파일은 파일 전송(구글 드라이브/USB 등) 후 기기에서 탭해 설치 가능합니다. 카톡 전송은 파일 변조 위험이 있어 비권장.

주문 상세 URL은 정적 라우팅 제약으로 **`/orders/detail?id=<주문UUID>`** 형식입니다.

## 웹만 배포할 때

`out/` 디렉터리 전체를 Nginx·S3·GitHub Pages 등 정적 호스팅에 올리면 됩니다. `npm run start`(Node 서버)는 정적 export 전제와 맞지 않으므로 사용하지 않습니다.

## iOS

CocoaPods 설치 후 루트에서 `npx cap add ios`, `npm run cap:sync`로 `ios/`를 생성할 수 있습니다.

## 현재 문서 위치
- `docs/README.md`: 기본 Next.js 안내 문서
- `docs/guide_db.md`: DB 스키마 및 샘플 데이터 가이드
- `docs/project_overview.md`: 본 프로젝트 요약 문서
