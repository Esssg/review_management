import { Capacitor } from "@capacitor/core";

/** execCommand 폴백: WebView·http 등에서 navigator.clipboard가 막힐 때 */
function copyViaExecCommand(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "0";
  textarea.style.top = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.padding = "0";
  textarea.style.border = "none";
  textarea.style.outline = "none";
  textarea.style.boxShadow = "none";
  textarea.style.background = "transparent";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  textarea.style.zIndex = "-1";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!ok) {
    throw new Error("execCommand copy failed");
  }
}

/**
 * 클립보드에 텍스트 복사.
 * Capacitor 앱(WebView)에서는 @capacitor/clipboard 우선, 그다음 Clipboard API, 마지막으로 execCommand.
 */
export async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("clipboard is only available in the browser");
  }

  if (Capacitor.isNativePlatform()) {
    try {
      const { Clipboard } = await import("@capacitor/clipboard");
      await Clipboard.write({ string: text });
      return;
    } catch {
      // WebView 정책 등으로 실패 시 아래 폴백
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // secure context 아님·권한 거부 등
    }
  }

  copyViaExecCommand(text);
}
