const koreaDatePartsFormatter = new Intl.DateTimeFormat("en", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 기기 시간대와 무관하게 한국 기준 YYYY-MM-DD 값을 만듭니다. */
export function getKoreaDateInputValue(date = new Date()) {
  const parts = koreaDatePartsFormatter.formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}
