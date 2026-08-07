/** execCommand 폴백: 브라우저에서 navigator.clipboard가 막힐 때 */
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
 * 브라우저 Clipboard API를 우선 사용하고, 실패하면 execCommand를 사용합니다.
 */
export async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("clipboard is only available in the browser");
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
