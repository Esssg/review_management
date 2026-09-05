# Google Play 출시 기준

## 확정된 앱 정보

- 앱 이름: `리뷰 매니저`
- Android 패키지명: `com.jinitlab.reviewmanager`
- 운영 주소: `https://rm.jinitlab.com`
- 출시 방식: Trusted Web Activity(TWA) + Bubblewrap
- 개발자 계정: 신규 개인 계정
- 공개 지원 이메일: `jinitlab@gmail.com`
- 기본 언어·초기 배포 지역: 한국어·대한민국
- 가격·수익화: 무료, 광고 없음, 인앱결제 없음

신규 개인 개발자 계정이므로 프로덕션 액세스를 신청하기 전에 12명 이상이 14일 연속 참여하는 비공개 테스트를 완료합니다.

## Play Console에 입력할 공개 URL

- 개인정보처리방침: `https://rm.jinitlab.com/privacy`
- 계정 및 데이터 삭제: `https://rm.jinitlab.com/account-deletion`

두 URL은 이 변경을 운영 서버에 배포한 뒤 로그인하지 않은 브라우저에서도 열리는지 다시 확인합니다.

## 심사용 로그인 계정

모든 핵심 기능이 로그인 뒤에 있으므로 Play Console의 **앱 액세스 권한(App access)** 항목에 심사용 자격 증명을 제공해야 합니다.

1. 운영 Supabase의 Authentication에서 Google Play 심사 전용 사용자를 만듭니다.
2. 실제 개인정보나 실제 계좌정보 대신 심사용 샘플 주문·설정만 등록합니다.
3. 이메일 확인, OTP, 2단계 인증 없이 이메일과 비밀번호만으로 로그인되는지 확인합니다.
4. 심사와 재심사가 끝날 때까지 계정을 삭제하거나 비밀번호를 바꾸지 않습니다.
5. 이메일과 비밀번호 원문은 저장소·문서·커밋에 기록하지 않고 Play Console의 앱 액세스 권한 입력란에만 등록합니다.

현재 `.env.local`에는 브라우저 검증용 테스트 계정 변수가 준비되어 있습니다. 이 계정을 심사용으로 재사용하려면 운영 서버 로그인 가능 여부와 데이터가 심사용 비민감 샘플인지 먼저 확인합니다.

### Play Console 심사 안내 문구

다음 문구와 별도로 제공한 이메일·비밀번호를 앱 액세스 권한 항목에 입력합니다.

> All core features require sign-in. Enter the provided email and password on the first screen, then tap “로그인”. No OTP or two-factor authentication is required. The review account contains non-sensitive sample data. For access issues, contact jinitlab@gmail.com.

## 심사 계정 확인 항목

- 로그인 후 구매 장부가 정상적으로 열림
- 주문 추가·상세·수정 화면 접근 가능
- 대시보드와 자동 추천 화면 접근 가능
- 설정의 개인정보처리방침과 계정 삭제 안내가 열림
- 앱을 재실행해도 세션이 유지되며 로그아웃 후 다시 로그인 가능

