import type { FieldComparison, TextComparisonMode } from "./types";

function normalize(text: string, mode: TextComparisonMode): string {
  switch (mode) {
    case "exact":
      return text;
    case "trimTrailingNewline":
      return text.replace(/\n+$/, "");
    case "ignoreLineOrder":
      return text
        .replace(/\n+$/, "")
        .split("\n")
        .sort()
        .join("\n");
  }
}

/**
 * 期待値(模範解答の実行結果)と実際の値(学習者の実行結果)を、指定した比較モードで
 * 正規化した上で突き合わせる。返す `expected`/`actual` は表示用に加工前の値をそのまま保持する。
 */
export function compareText(
  expected: string,
  actual: string,
  mode: TextComparisonMode = "trimTrailingNewline",
): FieldComparison<string> {
  return {
    match: normalize(expected, mode) === normalize(actual, mode),
    expected,
    actual,
  };
}
