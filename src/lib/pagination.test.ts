import { describe, expect, it } from "vitest";

import { fetchAllPages } from "./pagination";

describe("페이지 목록 조회", () => {
  it("페이지 크기를 넘는 결과를 다음 범위까지 이어서 읽는다", async () => {
    const ranges: Array<[number, number]> = [];
    const result = await fetchAllPages<number>(async (from, to) => {
      ranges.push([from, to]);
      const allRows = Array.from({ length: 1001 }, (_, index) => index);
      return { data: allRows.slice(from, to + 1), error: null };
    }, 1000);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1001);
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("중간 페이지 오류를 빈 목록으로 바꾸지 않고 반환한다", async () => {
    const result = await fetchAllPages<number>(async (from) => {
      if (from === 2) return { data: null, error: { message: "네트워크 오류" } };
      return { data: [from, from + 1], error: null };
    }, 2);

    expect(result.data).toBeNull();
    expect(result.error).toEqual({ message: "네트워크 오류" });
  });
});
