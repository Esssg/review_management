import type { Metadata } from "next";

import { LegalDocument } from "@/components/legal/legal-document";
import { APP_DEVELOPER_NAME, APP_NAME, APP_ORIGIN, APP_SUPPORT_EMAIL } from "@/lib/app-info";

export const metadata: Metadata = {
  title: `개인정보처리방침 | ${APP_NAME}`,
  description: `${APP_NAME}가 처리하는 개인정보와 이용 목적, 보관 및 삭제 기준을 안내합니다.`,
  alternates: { canonical: `${APP_ORIGIN}/privacy` },
};

const sectionTitleClassName = "text-lg font-semibold tracking-tight text-foreground";
const listClassName = "mt-3 list-disc space-y-2 pl-5 marker:text-primary";

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument
      title="개인정보처리방침"
      description={`${APP_DEVELOPER_NAME}은 ${APP_NAME} 이용자의 개인정보를 서비스 제공에 필요한 범위에서 처리하며, 이 방침에서 처리 항목과 목적을 안내합니다.`}
      effectiveDate="2026년 8월 18일"
    >
      <section aria-labelledby="privacy-scope">
        <h2 id="privacy-scope" className={sectionTitleClassName}>1. 적용 범위와 문의처</h2>
        <p className="mt-3">
          이 방침은 웹과 Google Play 앱으로 제공되는 {APP_NAME}에 적용됩니다. 개인정보 관련 문의, 열람·정정 또는 삭제 요청은 아래 이메일로 접수할 수 있습니다.
        </p>
        <p className="mt-3 rounded-lg bg-surface-soft px-4 py-3">
          개인정보 문의: <a href={`mailto:${APP_SUPPORT_EMAIL}`} className="font-semibold text-primary underline-offset-4 hover:underline">{APP_SUPPORT_EMAIL}</a>
        </p>
      </section>

      <section aria-labelledby="privacy-data">
        <h2 id="privacy-data" className={sectionTitleClassName}>2. 처리하는 데이터</h2>
        <ul className={listClassName}>
          <li><strong className="text-foreground">계정·인증 정보:</strong> 로그인 이메일, 표시 이름, 사용자 식별자와 로그인 세션 정보</li>
          <li><strong className="text-foreground">주문·업무 정보:</strong> 상품명, 주문번호, 플랫폼·결제수단·구매계정, 구매·입금·배송·수익 정보, 일정, 메모, 상품 URL, 리뷰 및 증빙 정보</li>
          <li><strong className="text-foreground">구매 정보 템플릿:</strong> 사용자가 입력한 구매자·수취인 이름, 로그인 아이디, 연락처, 주소, 계좌번호와 예금주</li>
          <li><strong className="text-foreground">계좌·입금 정보:</strong> 은행명, 계좌번호·예금주, 계좌 조회용 비밀번호, 주민등록번호 등 계좌 인증 식별정보와 입금 일시·상대방·금액</li>
          <li><strong className="text-foreground">AI 리뷰 정보:</strong> 상품명, 사용자가 입력한 리뷰 요청 문구, 성별·나이대·지역·직업·추가 설명으로 구성된 선택 프로필, 생성된 리뷰 초안</li>
          <li><strong className="text-foreground">알림·기기 정보:</strong> 사용자가 알림을 허용한 경우 Push endpoint와 구독 키, 기기 표시명, 브라우저 정보, 알림 발송·확인 상태</li>
          <li><strong className="text-foreground">자동 생성 정보:</strong> 서비스 이용 과정에서 쿠키, IP 주소, 브라우저·운영체제 정보, 접속 시각과 오류 기록이 생성될 수 있습니다.</li>
        </ul>
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          주문 메모나 AI 추가 문구처럼 자유롭게 입력하는 칸에는 서비스 운영에 필요하지 않은 개인정보를 입력하지 마세요.
        </p>
      </section>

      <section aria-labelledby="privacy-purpose">
        <h2 id="privacy-purpose" className={sectionTitleClassName}>3. 이용 목적</h2>
        <ul className={listClassName}>
          <li>로그인, 사용자 확인, 사용자별 데이터 분리와 서비스 제공</li>
          <li>주문 장부·대시보드·자동 추천·템플릿·설정의 저장과 동기화</li>
          <li>사용자가 요청한 AI 리뷰 초안 생성</li>
          <li>사용자가 허용한 구매 예정 알림 발송과 알림 상태 관리</li>
          <li>오류 대응, 부정 이용 방지, 보안 유지와 고객 문의 처리</li>
        </ul>
      </section>

      <section aria-labelledby="privacy-third-parties">
        <h2 id="privacy-third-parties" className={sectionTitleClassName}>4. 외부 처리와 제공</h2>
        <p className="mt-3">
          {APP_NAME}은 개인정보를 판매하거나 맞춤형 광고에 사용하지 않습니다. 서비스 제공에 필요한 경우에만 다음 처리자 또는 인프라로 데이터가 전달될 수 있습니다.
        </p>
        <ul className={listClassName}>
          <li><strong className="text-foreground">Supabase 기반 인증·데이터베이스 인프라:</strong> 계정 인증과 앱 데이터 저장·조회</li>
          <li><strong className="text-foreground">OpenAI:</strong> 사용자가 AI 리뷰 생성을 실행한 경우에만 상품명, 선택 프로필과 요청 문구를 리뷰 초안 생성 목적으로 처리</li>
          <li><strong className="text-foreground">브라우저·운영체제의 Web Push 제공자:</strong> 사용자가 알림을 허용한 경우 Push 구독 정보와 알림 메시지 전달</li>
        </ul>
        <p className="mt-3">
          법령에 따른 요청이나 이용자·서비스의 권리와 안전을 보호하기 위해 필요한 경우에는 관계 법령이 허용하는 범위에서 정보를 제공할 수 있습니다.
        </p>
      </section>

      <section aria-labelledby="privacy-security">
        <h2 id="privacy-security" className={sectionTitleClassName}>5. 보호 조치</h2>
        <ul className={listClassName}>
          <li>HTTPS를 사용해 앱과 서버 사이의 전송을 보호합니다.</li>
          <li>로그인 세션과 데이터베이스의 사용자별 접근 정책을 사용해 본인 데이터에만 접근하도록 제한합니다.</li>
          <li>운영 비밀값과 관리자 권한을 브라우저에 공개하지 않고 접근 권한을 필요한 범위로 제한합니다.</li>
          <li>비밀번호 원문은 앱 업무 데이터에 저장하지 않고 인증 시스템에서 처리합니다. 단, 사용자가 별도로 등록하는 계좌 조회용 비밀번호는 계좌 자동화 정보에 포함될 수 있습니다.</li>
        </ul>
      </section>

      <section aria-labelledby="privacy-retention">
        <h2 id="privacy-retention" className={sectionTitleClassName}>6. 보관과 삭제</h2>
        <ul className={listClassName}>
          <li>계정과 업무 데이터는 계정을 유지하고 서비스를 사용하는 동안 보관합니다.</li>
          <li>휴지통으로 이동한 주문은 사용자가 영구 삭제하거나 계정 삭제가 완료될 때까지 보관합니다.</li>
          <li>Push 구독은 사용자가 알림을 해제하거나 구독·계정을 삭제할 때까지 보관합니다.</li>
          <li>계정 삭제 요청이 확인되면 인증 계정과 연결된 앱 데이터를 비활성화만 하지 않고 삭제합니다.</li>
          <li>법령상 의무, 보안 또는 분쟁 대응을 위해 일부 정보를 보관해야 하는 경우에는 필요한 최소 범위와 기간만 보관한 뒤 삭제하며, 요청자에게 사유를 안내합니다.</li>
        </ul>
        <p className="mt-3">
          자세한 절차는 <a href="/account-deletion" className="font-semibold text-primary underline-offset-4 hover:underline">계정 및 데이터 삭제 안내</a>에서 확인할 수 있습니다.
        </p>
      </section>

      <section aria-labelledby="privacy-rights">
        <h2 id="privacy-rights" className={sectionTitleClassName}>7. 이용자의 선택과 권리</h2>
        <p className="mt-3">
          이용자는 앱에서 자신의 주문·설정·템플릿을 조회하거나 수정·삭제할 수 있고, 알림 권한과 Push 구독을 언제든 해제할 수 있습니다. 계정과 연결 데이터 전체의 삭제 또는 개인정보 관련 요청은 {APP_SUPPORT_EMAIL}으로 접수할 수 있습니다.
        </p>
      </section>

      <section aria-labelledby="privacy-children">
        <h2 id="privacy-children" className={sectionTitleClassName}>8. 아동의 이용</h2>
        <p className="mt-3">
          {APP_NAME}은 성인의 주문 운영 업무를 위한 서비스이며 만 14세 미만 아동을 대상으로 하지 않습니다. 아동의 정보가 동의 없이 처리된 사실을 알게 된 경우 문의처로 알려주시면 확인 후 삭제합니다.
        </p>
      </section>

      <section aria-labelledby="privacy-changes">
        <h2 id="privacy-changes" className={sectionTitleClassName}>9. 방침 변경</h2>
        <p className="mt-3">
          처리 데이터나 서비스 기능이 달라지면 이 방침을 갱신하고 시행일을 변경합니다. 중요한 변경은 앱 또는 서비스 화면을 통해 알립니다.
        </p>
      </section>
    </LegalDocument>
  );
}

