const HEX_COLOR_RE = /^#([0-9a-f]{6})$/i;

export function normalizeHexColor(value: string | null | undefined, fallback: string): string {
  const v = (value ?? "").trim();
  return HEX_COLOR_RE.test(v) ? v.toLowerCase() : fallback.toLowerCase();
}

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = normalizeHexColor(hex, "#64748b");
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  const a = Number.isFinite(alpha) ? Math.max(0, Math.min(alpha, 1)) : 1;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
