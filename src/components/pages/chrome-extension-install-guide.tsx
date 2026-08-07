import { ChevronDown, Download, Puzzle } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// 익스텐션 프로젝트의 dist 배포본과 자동추천 페이지의 다운로드 링크를 같은 버전으로 맞춥니다.
const extensionVersion = "0.1.0";
const extensionDownloadHref = `/downloads/review-manager-chrome-extension-v${extensionVersion}.zip`;

const installSteps = [
  {
    title: "파일 다운로드 및 압축 해제",
    description: "다운로드한 ZIP 파일을 자주 사용할 폴더에 압축 해제하세요.",
  },
  {
    title: "Chrome 확장 프로그램 화면 열기",
    description: (
      <>
        Chrome 주소창에 <code className="rounded bg-sky-100 px-1.5 py-0.5 font-mono text-[11px] dark:bg-sky-900/60">chrome://extensions</code>를 입력하세요.
      </>
    ),
  },
  {
    title: "개발자 모드 켜기",
    description: "오른쪽 위의 개발자 모드를 켠 다음, 압축해제된 확장 프로그램을 로드합니다를 선택하세요.",
  },
  {
    title: "압축 해제한 폴더 선택",
    description: "manifest.json 파일이 바로 들어 있는 폴더를 선택하세요. ZIP 파일 자체가 아니라 압축을 해제한 폴더를 선택해야 합니다.",
  },
  {
    title: "익스텐션 사용 시작",
    description: "익스텐션을 Chrome toolbar에 고정하고, 쿠팡 주문목록 페이지를 새로고침한 뒤 구매내역 가져오기를 실행하세요.",
  },
] as const;

export function ChromeExtensionInstallGuide() {
  return (
    <section
      aria-labelledby="chrome-extension-install-guide-title"
      className="overflow-hidden rounded-2xl border border-sky-200 bg-sky-50/80 shadow-sm dark:border-sky-900/60 dark:bg-sky-950/30"
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-200">
            <Puzzle className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="chrome-extension-install-guide-title" className="text-base font-semibold text-sky-950 dark:text-sky-100">
                쿠팡 구매내역 크롬 익스텐션
              </h2>
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-800">
                v{extensionVersion}
              </span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-sky-900/80 dark:text-sky-100/80">
              쿠팡 구매내역을 자동추천 목록으로 가져오려면 Chrome 익스텐션을 먼저 설치하세요.
            </p>
          </div>
        </div>
        <a
          href={extensionDownloadHref}
          download={`review-manager-chrome-extension-v${extensionVersion}.zip`}
          className={cn(buttonVariants({ size: "default" }), "w-full bg-primary text-primary-foreground shadow-sm hover:bg-primary-active sm:w-auto")}
        >
          <Download className="h-4 w-4" aria-hidden />
          익스텐션 다운로드
        </a>
      </div>

      <div className="border-t border-sky-200/80 bg-white/60 px-4 py-3 dark:border-sky-900/60 dark:bg-slate-900/20 sm:px-5">
        <details>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-sky-900 marker:hidden dark:text-sky-100">
            <span>설치 및 사용 방법 보기</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden />
          </summary>
          <ol className="mt-4 flex flex-col gap-3">
            {installSteps.map((step, index) => (
              <li key={step.title} className="flex min-w-0 gap-3 text-sm text-sky-950/85 dark:text-sky-100/85">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-600 text-[11px] font-bold text-white">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">{step.title}</p>
                  <p className="mt-0.5 leading-relaxed">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 rounded-lg bg-sky-100/80 px-3 py-2 text-xs leading-relaxed text-sky-900/80 dark:bg-sky-900/40 dark:text-sky-100/80">
            익스텐션을 새로 등록하거나 다시 로드한 뒤에는 이미 열려 있는 쿠팡 주문목록 페이지도 새로고침해야 합니다.
          </p>
        </details>
      </div>
    </section>
  );
}
