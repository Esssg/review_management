# Review Manager 프로젝트 정리

## 프로젝트 개요
- 리뷰/주문 운영 데이터를 관리하기 위한 Next.js 기반 웹 애플리케이션입니다.
- 프론트엔드는 Next.js App Router 구조를 사용하고, 백엔드는 Supabase(PostgreSQL/Auth)를 활용합니다.
- 주문 데이터의 등록/조회/상태 관리를 중심으로 동작합니다.
- 입금 계좌 정보는 `bank_account`, 계좌별 입금일·시각·상대방·금액 내역은 `bank_account_deposit`에 저장하며, 두 테이블 모두 인증 사용자 소유 데이터로 RLS가 적용됩니다.
- 자동 추천(`/menu-4`)은 좌우 슬라이드 2페이지 화면입니다. 페이지 이동 화살표는 슬라이더 좌/우 중앙에 떠 있는 원형 버튼으로 표시되며, 현재 페이지에서 갈 수 없는 방향의 버튼은 숨겨집니다. 첫 페이지 "주문 내역 자동 추천"은 `crawl_orders`의 처리 대기 행을 `purchase_date` 내림차순으로 보여주고, 검수해 `orders`로 저장하거나 목록 행 hover 시 나타나는 삭제 버튼으로 삭제 상태로 바꾸는 크롤링 주문 확인 화면입니다. 새로고침 버튼은 사용자 `platform_accounts`의 크롤링 상태와 `name`을 확인하고, 실행 중이 아니면 계정별 쿠팡 크롤링 API를 호출하며 HTTP 2xx 성공 응답 여부에 따라 계정명 기반 완료/실패 메시지를 표시합니다. 실패 시 화면 문구와 브라우저 콘솔에 HTTP 상태 또는 네트워크 오류를 남깁니다. 두 번째 페이지 "입금 내역 자동 추천"은 `bank_account_deposit.bank_account_deposit_status = 0`인 입금 내역을 `date`, `time` 오름차순으로 보여주고, `bank_account`의 계좌명·은행·계좌번호와 함께 표시합니다. 각 입금 행에는 hover 시(모바일은 상시) 삭제 버튼이 나타나며, 누르면 `bank_account_deposit_status`를 99로 바꿔 목록에서 숨깁니다. 입금 건을 펼치면 미완료 `orders` 중 입금자명과 주문 제목 유사도가 높은 후보(최대 3개)를 우선 보여주며, 후보가 없고 입금자명 앞 4자리가 숫자이면 이를 `MMDD`로 보고 주문 구매일의 월·일이 같은 후보를 보여줍니다. 후보 카드에는 주문의 플랫폼·구매계정 색상이 들어간 작은 아이콘과 구매물품명, 구매일·구매금액이 함께 표시됩니다. 후보 완료처리 시 주문의 입금일·입금금액·입금메모를 입금 내역 값으로 채우고 `bank_account_deposit_status`를 1로 바꿉니다.
- 구매장부(`/`)의 미완료 주문 완료처리는 모바일 펼침 패널과 데스크톱 드롭다운에서 입금일자를 오늘(한국 시간), 입금금액을 구매금액, 입금메모를 카톡방 이름(`orders.title`)으로 기본 입력합니다. 입금일자는 `-1일`/`+1일`, 입금금액은 `-500원`/`+500원` 버튼으로 보정할 수 있습니다. 완료 직전 미배송 상품의 구매금액과 입금금액이 같거나, 배송 상품의 두 금액이 다르면 커스텀 확인창에서 `취소하기` 또는 `무시하고 처리하기`를 선택하게 하며 Enter 키는 확인으로 처리합니다.
- 크롤링 호출 경로는 빌드 모드에 따라 다릅니다. **웹(Vercel) 배포**는 `NEXT_PUBLIC_CRAWL_API_BASE_URL` 값이 있어도 같은 도메인의 서버 프록시(`/api/crawl/coupang`, `src/app/api/crawl/coupang/route.ts`)를 거쳐 외부 크롤링 서버(`http://175.125.243.56:8003`)에 요청을 보내고 외부 응답 상태를 클라이언트에 전달합니다. **Capacitor APK 빌드**(`BUILD_TARGET=apk`)는 정적 export라 서버 라우트가 없으므로 앱 안의 Capacitor 런타임에서만 `NEXT_PUBLIC_CRAWL_API_BASE_URL`로 지정한 외부 크롤링 서버 절대 URL을 직접 호출합니다. HTTPS 페이지에서 평문 HTTP 외부 서버를 직접 부르면 Mixed Content로 막히는 문제를 이 분기로 회피합니다.
- APK에서 평문 HTTP 외부 서버를 직접 호출하기 위해 두 가지 보안 완화가 적용돼 있습니다. ① `capacitor.config.ts`의 `server.androidScheme = "http"`로 WebView origin을 `http://localhost`로 띄워 Mixed Content 차단을 회피하고, ② `android/app/src/main/AndroidManifest.xml`에 `android:usesCleartextTraffic="true"`로 안드로이드 자체의 평문 트래픽 차단을 해제합니다. 외부 서버가 HTTPS로 전환되면 두 설정 모두 되돌리는 것을 권장합니다.
- **Capacitor 내장형**: `BUILD_TARGET=apk next build`로 정적 사이트(`out/`)를 만들고, APK 안 WebView에서 UI를 로드합니다. 데이터·로그인은 **온라인 Supabase**와 통신합니다(맥에서 Next를 켜둘 필요 없음). 웹 배포(`next build`)는 서버 라우트를 포함한 일반 Next.js 빌드를 만듭니다.

## 기술 스택
- 프레임워크: `next@16`, `react@19`, `typescript` — `BUILD_TARGET=apk`일 때만 `output: "export"`(정적), 그 외(예: Vercel)는 서버 라우트를 포함한 일반 빌드
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
- `npm run dev` / `npm run dev:lan`: 로컬 개발(서버 라우트 포함, HMR)
- `npm run build`: Vercel 등 서버 호스팅용 일반 Next.js 빌드(서버 라우트 포함)
- `BUILD_TARGET=apk npm run build`: 정적 사이트를 `out/`에 생성(Capacitor APK용)
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
