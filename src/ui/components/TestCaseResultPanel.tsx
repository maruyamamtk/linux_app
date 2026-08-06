import { Platform, StyleSheet, Text, View } from "react-native";

import type { ScriptTestCaseResult } from "../../engine/grading";

export interface TestCaseResultPanelProps {
  results: ScriptTestCaseResult[];
}

/**
 * スクリプト作成モードの「複数テストケースに対する実行と合否表示パネル」
 * (docs/requirements.md 3章8節)。判定ロジックは持たず、`engine/grading` が返した
 * `ScriptTestCaseResult[]` をそのまま表示するだけ。
 */
export function TestCaseResultPanel({ results }: TestCaseResultPanelProps) {
  if (results.length === 0) return null;

  const passedCount = results.filter((result) => result.grade.passed).length;
  const allPassed = passedCount === results.length;

  return (
    <View style={styles.container}>
      <Text style={[styles.summary, allPassed ? styles.summaryPass : styles.summaryFail]}>
        {passedCount}/{results.length} 件成功
      </Text>
      {results.map((result, index) => (
        <View key={result.testCase.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={[styles.badge, result.grade.passed ? styles.badgePass : styles.badgeFail]}>
              {result.grade.passed ? "PASS" : "FAIL"}
            </Text>
            <Text style={styles.title}>
              {result.testCase.description ?? `テストケース ${index + 1}`}
            </Text>
          </View>
          <Text style={styles.caseInput}>
            引数: {result.testCase.args && result.testCase.args.length > 0 ? result.testCase.args.join(" ") : "(なし)"}
            {"  "}標準入力: {result.testCase.stdin ? JSON.stringify(result.testCase.stdin) : "(なし)"}
          </Text>
          {!result.grade.passed && (
            <View style={styles.detail}>
              {!result.grade.stdout.match && (
                <>
                  <Text style={styles.detailLabel}>期待する標準出力</Text>
                  <Text style={styles.detailValue}>{result.grade.stdout.expected || "(空)"}</Text>
                  <Text style={styles.detailLabel}>実際の標準出力</Text>
                  <Text style={styles.detailValue}>{result.grade.stdout.actual || "(空)"}</Text>
                </>
              )}
              {!result.grade.stderr.match && (
                <>
                  <Text style={styles.detailLabel}>実際の標準エラー出力</Text>
                  <Text style={styles.detailValue}>{result.grade.stderr.actual || "(空)"}</Text>
                </>
              )}
              {!result.grade.exitCode.match && (
                <Text style={styles.detailLabel}>
                  終了ステータス: 期待値 {result.grade.exitCode.expected} / 実際 {result.grade.exitCode.actual}
                </Text>
              )}
              {result.grade.vfsMismatches.length > 0 && (
                <Text style={styles.detailLabel}>
                  ファイルシステムの状態が模範解答と異なります({result.grade.vfsMismatches.length}件)
                </Text>
              )}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  summary: { fontSize: 15, fontWeight: "700" },
  summaryPass: { color: "#1a7f37" },
  summaryFail: { color: "#cf222e" },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d0d7de",
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  badgePass: { backgroundColor: "#1a7f37" },
  badgeFail: { backgroundColor: "#cf222e" },
  title: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  caseInput: { fontSize: 12, color: "#57606a" },
  detail: { marginTop: 4, gap: 2 },
  detailLabel: { fontSize: 11, fontWeight: "600", color: "#57606a" },
  detailValue: {
    fontSize: 12,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    color: "#24292f",
    backgroundColor: "#f6f8fa",
    padding: 4,
    borderRadius: 4,
  },
});
