import { describe, expect, it } from "vitest";

import { compareText } from "./textComparison";

describe("compareText", () => {
  it("exact: 完全に同じ文字列のみ一致とする", () => {
    expect(compareText("hello\n", "hello\n", "exact").match).toBe(true);
    expect(compareText("hello\n", "hello", "exact").match).toBe(false);
  });

  it("trimTrailingNewline(デフォルト): 末尾改行の有無・個数の違いは無視する", () => {
    expect(compareText("hello\n", "hello", "trimTrailingNewline").match).toBe(true);
    expect(compareText("hello\n", "hello\n\n", "trimTrailingNewline").match).toBe(true);
    expect(compareText("hello\n", "hello")).toEqual({ match: true, expected: "hello\n", actual: "hello" });
  });

  it("trimTrailingNewline: 末尾以外の違いは一致と見なさない", () => {
    expect(compareText("hello\n", "Hello\n", "trimTrailingNewline").match).toBe(false);
  });

  it("ignoreLineOrder: 行の順序が違っても同じ行集合なら一致とする", () => {
    expect(compareText("a\nb\nc\n", "c\na\nb\n", "ignoreLineOrder").match).toBe(true);
  });

  it("ignoreLineOrder: 行の内容自体が異なれば不一致とする", () => {
    expect(compareText("a\nb\n", "a\nc\n", "ignoreLineOrder").match).toBe(false);
  });

  it("比較結果には加工前のexpected/actualをそのまま含める", () => {
    const result = compareText("a\nb\n", "b\na\n", "ignoreLineOrder");
    expect(result.expected).toBe("a\nb\n");
    expect(result.actual).toBe("b\na\n");
  });
});
