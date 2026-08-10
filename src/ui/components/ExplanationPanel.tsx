import { Platform, StyleSheet, Text, View } from "react-native";

export interface ExplanationPanelProps {
  referenceSolution: string;
  explanation?: string;
}

/**
 * 不正解時に表示する「模範解答コマンド+解説」パネル(docs/requirements.md 3章6節)。
 * 段階的ヒントをすべて確認したあと、または答え合わせで不正解になったあとにのみ
 * 呼び出し側が表示するため、いきなり答えを見せない設計になっている。
 */
export function ExplanationPanel({ referenceSolution, explanation }: ExplanationPanelProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>模範解答</Text>
      <Text style={styles.solution}>{referenceSolution}</Text>
      {explanation && (
        <>
          <Text style={styles.label}>解説</Text>
          <Text style={styles.explanation}>{explanation}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
    padding: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d0d7de",
    backgroundColor: "#f6f8fa",
  },
  label: { fontSize: 12, fontWeight: "700", color: "#57606a" },
  solution: {
    fontSize: 13,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    color: "#24292f",
    backgroundColor: "#eaeef2",
    padding: 6,
    borderRadius: 4,
  },
  explanation: { fontSize: 13, color: "#24292f", lineHeight: 19 },
});
