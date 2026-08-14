import { useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { useSettings } from "../../state/SettingsContext";
import type { ThemeColors } from "../../theme/colors";

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
  const { colors } = useSettings();
  const styles = useMemo(() => createStyles(colors), [colors]);

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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: 4,
      padding: 10,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    label: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },
    solution: {
      fontSize: 13,
      fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
      color: colors.text,
      backgroundColor: colors.surfaceAlt,
      padding: 6,
      borderRadius: 4,
    },
    explanation: { fontSize: 13, color: colors.text, lineHeight: 19 },
  });
}
