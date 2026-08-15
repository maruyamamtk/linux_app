import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { exercises } from "../../content/exercises";
import type { RootStackParamList } from "../../navigation/types";
import { useProgress } from "../../state/ProgressContext";
import { useSettings } from "../../state/SettingsContext";
import type { ThemeColors } from "../../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "QuizExercise">;

/**
 * 選択式クイズ画面(docs/requirements.md 2章 Ch2-3): 仮想ターミナルを使わず、
 * choices/correctChoiceIndexで正誤判定する。判定ロジックは単純な配列比較のみで、
 * 採点エンジン(engine/grading)は使わない(ターミナル操作を伴わないため)。
 */
export function QuizExerciseScreen({ route }: Props) {
  const exercise = exercises.find((item) => item.id === route.params.exerciseId);
  const { recordAttempt } = useProgress();
  const { colors } = useSettings();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.bottom), [colors, insets.bottom]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [visibleHintCount, setVisibleHintCount] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);

  if (!exercise || exercise.type !== "quiz" || !exercise.choices) {
    return (
      <View style={styles.container}>
        <Text style={styles.prompt}>演習が見つかりませんでした。</Text>
      </View>
    );
  }

  const hints = exercise.hints ?? [];
  const answered = selectedIndex !== null;
  const passed = answered && selectedIndex === exercise.correctChoiceIndex;
  const canShowExplanation = answered && !passed;

  function handleShowHint() {
    setVisibleHintCount((count) => Math.min(count + 1, hints.length));
  }

  function handleSelectChoice(index: number) {
    if (answered || !exercise) return;
    setSelectedIndex(index);
    setShowExplanation(false);
    recordAttempt(exercise.id, index === exercise.correctChoiceIndex);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.prompt}>{exercise.prompt}</Text>

      {hints.slice(0, visibleHintCount).map((hint, index) => (
        <Text key={hint} style={styles.hint}>
          ヒント{index + 1}: {hint}
        </Text>
      ))}

      <View style={styles.choices}>
        {exercise.choices.map((choice, index) => {
          const isSelected = selectedIndex === index;
          const isCorrectChoice = index === exercise.correctChoiceIndex;
          const showAsCorrect = answered && isCorrectChoice;
          const showAsWrong = answered && isSelected && !isCorrectChoice;
          return (
            <Pressable
              key={choice}
              style={[
                styles.choiceButton,
                showAsCorrect && styles.choiceCorrect,
                showAsWrong && styles.choiceWrong,
              ]}
              onPress={() => handleSelectChoice(index)}
              disabled={answered}
            >
              <Text style={styles.choiceText}>{choice}</Text>
            </Pressable>
          );
        })}
      </View>

      {answered && (
        <Text style={passed ? styles.resultPass : styles.resultFail}>
          {passed ? "正解です!" : "不正解です。もう一度考えてみましょう。"}
        </Text>
      )}

      {showExplanation && exercise.explanation && (
        <View style={styles.explanationBox}>
          <Text style={styles.explanationLabel}>解説</Text>
          <Text style={styles.explanationText}>{exercise.explanation}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          style={styles.actionButton}
          onPress={handleShowHint}
          disabled={hints.length === 0 || visibleHintCount >= hints.length}
        >
          <Text style={styles.actionButtonText}>
            {hints.length === 0 ? "ヒントなし" : `ヒントを見る (${visibleHintCount}/${hints.length})`}
          </Text>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={() => setShowExplanation(true)}
          disabled={!canShowExplanation || showExplanation}
        >
          <Text style={styles.actionButtonText}>解説を見る</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors, bottomInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 16 + bottomInset, gap: 12 },
    prompt: { fontSize: 16, color: colors.text },
    hint: { fontSize: 14, color: colors.textSecondary },
    choices: { gap: 8 },
    choiceButton: {
      padding: 12,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    choiceCorrect: { backgroundColor: colors.successBg, borderColor: colors.success },
    choiceWrong: { backgroundColor: colors.dangerBg, borderColor: colors.danger },
    choiceText: { fontSize: 14, color: colors.text },
    resultPass: { fontSize: 15, fontWeight: "600", color: colors.success },
    resultFail: { fontSize: 15, fontWeight: "600", color: colors.danger },
    explanationBox: {
      gap: 4,
      padding: 10,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    explanationLabel: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },
    explanationText: { fontSize: 13, color: colors.text, lineHeight: 19 },
    actions: { flexDirection: "row", gap: 12 },
    actionButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: "center",
      backgroundColor: colors.chip,
    },
    actionButtonText: { fontSize: 14, fontWeight: "600", color: colors.text },
  });
}
