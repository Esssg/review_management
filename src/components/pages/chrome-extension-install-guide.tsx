"use client";

import { useState } from "react";
import { ChevronDown, Download, Puzzle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// 배포한 ZIP 파일을 최신 버전부터 표시합니다. 새 ZIP을 추가하면 이 목록에도 함께 등록합니다.
const extensionDownloads = [
  {
    version: "0.1.1",
    filename: "review-manager-chrome-extension-v0.1.1.zip",
    href: "/downloads/review-manager-chrome-extension-v0.1.1.zip",
    isLatest: true,
  },
  {
    version: "0.1.0",
    filename: "review-manager-chrome-extension-v0.1.0.zip",
    href: "/downloads/review-manager-chrome-extension-v0.1.0.zip",
    isLatest: false,
  },
] as const;

const latestExtensionVersion = extensionDownloads[0].version;

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
  const [selectedVersions, setSelectedVersions] = useState<Set<string>>(
    () => new Set([latestExtensionVersion]),
  );
  const [downloadMessage, setDownloadMessage] = useState("");
  const selectedExtensions = extensionDownloads.filter(({ version }) => selectedVersions.has(version));
  const allVersionsSelected = selectedVersions.size === extensionDownloads.length;

  function toggleVersion(version: string) {
    setSelectedVersions((currentVersions) => {
      const nextVersions = new Set(currentVersions);
      if (nextVersions.has(version)) {
        nextVersions.delete(version);
      } else {
        nextVersions.add(version);
      }
      return nextVersions;
    });
    setDownloadMessage("");
  }

  function toggleAllVersions() {
    setSelectedVersions(
      allVersionsSelected ? new Set() : new Set(extensionDownloads.map(({ version }) => version)),
    );
    setDownloadMessage("");
  }

  function downloadSelectedExtensions() {
    if (selectedExtensions.length === 0) return;

    // 브라우저가 여러 파일 다운로드를 한 번에 처리하도록 선택된 링크를 순서대로 실행합니다.
    selectedExtensions.forEach(({ href, filename }) => {
      const downloadLink = document.createElement("a");
      downloadLink.href = href;
      downloadLink.download = filename;
      document.body.append(downloadLink);
      downloadLink.click();
      downloadLink.remove();
    });

    setDownloadMessage(`${selectedExtensions.length}개 버전의 다운로드를 시작했습니다.`);
  }

  return (
    <section
      aria-labelledby="chrome-extension-install-guide-title"
      className="overflow-hidden rounded-2xl border border-sky-200 bg-sky-50/80 shadow-sm dark:border-sky-900/60 dark:bg-sky-950/30"
    >
      <div className="flex flex-col gap-4 p-4 sm:p-5">
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
                최신 v{latestExtensionVersion}
              </span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-sky-900/80 dark:text-sky-100/80">
              쿠팡 구매내역을 자동추천 목록으로 가져오려면 Chrome 익스텐션을 먼저 설치하세요.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-sky-200/80 bg-white/60 p-3 dark:border-sky-900/60 dark:bg-slate-900/20 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-sky-950 dark:text-sky-100">다운로드할 버전 선택</p>
              <p className="mt-0.5 text-xs text-sky-900/70 dark:text-sky-100/70">필요한 버전을 하나 이상 선택하세요.</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={allVersionsSelected}
              onClick={toggleAllVersions}
              className="h-8 text-sky-700 hover:bg-sky-100 hover:text-sky-900 dark:text-sky-200 dark:hover:bg-sky-900/50 dark:hover:text-sky-100"
            >
              {allVersionsSelected ? "전체 선택 해제" : "전체 선택"}
            </Button>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2" role="group" aria-label="익스텐션 버전 선택">
            {extensionDownloads.map(({ version, filename, isLatest }) => {
              const isSelected = selectedVersions.has(version);

              return (
                <label
                  key={version}
                  className={cn(
                    "flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                    isSelected
                      ? "border-primary/50 bg-white shadow-sm ring-1 ring-primary/20 dark:border-sky-700/80 dark:bg-slate-900/50"
                      : "border-sky-200/70 bg-white/50 hover:border-sky-300 dark:border-sky-800/70 dark:bg-slate-900/20 dark:hover:border-sky-700",
                  )}
                >
                  <input
                    type="checkbox"
                    value={version}
                    checked={isSelected}
                    onChange={() => toggleVersion(version)}
                    aria-label={`v${version} 다운로드 선택`}
                    className="h-5 w-5 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sky-950 dark:text-sky-100">v{version}</span>
                      {isLatest ? (
                        <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-900/60 dark:text-sky-200">
                          최신
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-sky-900/65 dark:text-sky-100/65">{filename}</span>
                  </span>
                </label>
              );
            })}
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <p className="text-xs text-sky-900/75 dark:text-sky-100/75">
              {selectedExtensions.length === 0
                ? "다운로드할 버전을 하나 이상 선택하세요."
                : `${selectedExtensions.length}개 버전이 선택되었습니다.`}
            </p>
            <Button
              type="button"
              disabled={selectedExtensions.length === 0}
              onClick={downloadSelectedExtensions}
              className="w-full bg-primary text-primary-foreground shadow-sm hover:bg-primary-active"
            >
              <Download className="h-4 w-4" aria-hidden />
              {selectedExtensions.length > 0 ? `선택한 ${selectedExtensions.length}개 다운로드` : "버전 선택 후 다운로드"}
            </Button>
            <p className="text-[11px] leading-relaxed text-sky-900/65 dark:text-sky-100/65">
              여러 파일을 선택하면 Chrome에서 여러 다운로드 허용을 확인할 수 있습니다.
            </p>
            <p aria-live="polite" className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
              {downloadMessage}
            </p>
          </div>
        </div>
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
