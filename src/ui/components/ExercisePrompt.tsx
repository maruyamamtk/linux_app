import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useSettings } from "../../state/SettingsContext";
import type { ThemeColors } from "../../theme/colors";

export interface ExercisePromptProps {
  prompt: string;
  promptSteps?: string[];
}

/**
 * 演習の問題文表示。`promptSteps`が2件以上あれば「1. 〜」のような番号付き箇条書きとして表示し、
 * それ以外(未指定、または1件のみ)は従来通り`prompt`を単一の文として表示する。
 */
export function ExercisePrompt({ prompt, promptSteps }: ExercisePromptProps) {
  const { colors } = useSettings();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (promptSteps && promptSteps.length > 1) {
    return (
      <View style={styles.stepList}>
        {promptSteps.map((step, index) => (
          <Text key={index} style={styles.prompt}>
            {index + 1}. {step}
          </Text>
        ))}
      </View>
    );
  }

  return <Text style={styles.prompt}>{prompt}</Text>;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    stepList: { gap: 4 },
    prompt: { fontSize: 16, color: colors.text },
  });
}
