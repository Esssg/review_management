import type { Metadata } from "next";

import { LegalDocument } from "@/components/legal/legal-document";
import { APP_NAME, APP_ORIGIN, APP_SUPPORT_EMAIL } from "@/lib/app-info";

export const metadata: Metadata = {
  title: `계정 및 데이터 삭제 | ${APP_NAME}`,
  description: `${APP_NAME} 계정과 연결된 데이터의 삭제를 요청하는 방법을 안내합니다.`,
  alternates: { canonical: `${APP_ORIGIN}/account-deletion` },
};

const deletionMailHref = `mailto:${APP_SUPPORT_EMAIL}?subject=${encodeURIComponent(`[${APP_NAME}] 계정 및 데이터 삭제 요청`)}`;
const sectionTitleClassName = "text-lg font-semibold tracking-tight text-foreground";
const listClassName = "mt-3 list-disc space-y-2 pl-5 marker:text-primary";

export default function AccountDeletionPage() {
  return (
    <LegalDocument
      title="계정 및 데이터 삭제"
      description={`${APP_NAME}에서 발급받은 계정과 그 계정에 연결된 데이터를 삭제하도록 요청하는 방법을 안내합니다.`}
      effectiveDate="2026년 8월 18일"
    >
      <section aria-labelledby="deletion-request">
        <h2 id="deletion-request" className={sectionTitleClassName}>삭제 요청 방법</h2>
        <p className="mt-3">
          {APP_NAME}은 앱 안에서 직접 회원가입을 제공하지 않고 운영자가 계정을 발급합니다. 발급된 계정은 아래 이메일 경로를 통해 언제든 삭제 요청할 수 있습니다.
        </p>
        <ol className="mt-4 list-decimal space-y-3 pl-5 marker:font-semibold marker:text-primary">
          <li>가능하면 로그인에 사용하는 이메일 계정에서 삭제 요청 이메일을 보냅니다.</li>
          <li>제목에 <strong className="text-foreground">[{APP_NAME}] 계정 및 데이터 삭제 요청</strong>을 입력하고, 본문에는 삭제할 계정 이메일만 적습니다.</li>
          <li>운영자가 등록 이메일로 본인 확인을 요청할 수 있습니다. 확인이 끝나면 삭제 일정과 완료 여부를 이메일로 안내합니다.</li>
        </ol>
        <a
          href={deletionMailHref}
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-5 py-2.5 text-center font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-colors hover:bg-primary-active sm:w-auto"
        >
          삭제 요청 이메일 작성
        </a>
        <p className="mt-3 text-xs leading-relaxed text-ink-muted">
          비밀번호, 계좌 비밀번호, 주민등록번호, 인증번호는 이메일에 적지 마세요.
        </p>
      </section>

      <section aria-labelledby="deletion-data">
        <h2 id="deletion-data" className={sectionTitleClassName}>삭제되는 데이터</h2>
        <p className="mt-3">본인 확인이 완료되면 다음 계정과 연결 데이터를 삭제합니다.</p>
        <ul className={listClassName}>
          <li>인증 계정, 로그인 이메일, 표시 이름과 사용자 식별자</li>
          <li>활성 주문과 휴지통 주문, 크롤링 주문 및 관련 리뷰·메모·일정</li>
          <li>플랫폼·결제수단·구매계정, 구매 정보 템플릿과 저장한 보기</li>
          <li>은행 계좌 정보와 입금 내역</li>
          <li>AI 리뷰 프로필, 요청 문구와 생성된 리뷰</li>
          <li>업무 설정, 자동 저장 초안, Push 구독과 앱 알림 내역</li>
        </ul>
      </section>

      <section aria-labelledby="deletion-time">
        <h2 id="deletion-time" className={sectionTitleClassName}>처리 시간과 보관 예외</h2>
        <p className="mt-3">
          본인 확인이 끝난 요청은 통상 7일 이내 처리합니다. 추가 확인이나 법령상 보존 의무가 있어 더 오래 걸리는 경우에는 사유와 예상 완료일을 이메일로 안내합니다.
        </p>
        <p className="mt-3">
          현재 별도로 보존하도록 정한 계정 데이터는 없습니다. 다만 법령상 의무, 보안 또는 분쟁 대응을 위해 보관이 꼭 필요한 정보가 생긴 경우에는 최소 범위만 해당 기간 동안 분리 보관한 뒤 삭제합니다.
        </p>
      </section>

      <section aria-labelledby="deletion-warning">
        <h2 id="deletion-warning" className={sectionTitleClassName}>삭제 전 확인</h2>
        <ul className={listClassName}>
          <li>계정 삭제는 단순 비활성화가 아니라 계정과 연결 데이터의 영구 삭제입니다.</li>
          <li>완료된 삭제는 되돌릴 수 없으며, 같은 이메일로 다시 계정을 발급받아도 이전 데이터는 복구되지 않습니다.</li>
          <li>일부 데이터만 삭제하려면 앱에서 해당 주문·템플릿·설정을 먼저 삭제하거나 문의 이메일에 원하는 범위를 적어 주세요.</li>
        </ul>
      </section>
    </LegalDocument>
  );
}

