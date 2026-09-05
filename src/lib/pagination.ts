export type PageError = { message: string };

export type PageResult<T> = {
  data: T[] | null;
  error: PageError | null;
};

/** Supabase의 페이지 크기 제한을 넘는 목록을 끝까지 읽습니다. */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<PageResult<T>>,
  pageSize = 1000,
): Promise<PageResult<T>> {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error("페이지 크기는 1 이상이어야 합니다.");
  }

  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const result = await fetchPage(from, from + pageSize - 1);
    if (result.error) return { data: null, error: result.error };

    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}
