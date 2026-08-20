import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { exercises } from "../../content/exercises";
import { compareText } from "../../engine/grading";
import type { RootStackParamList } from "../../navigation/types";
import { useProgress } from "../../state/ProgressContext";
import { useSettings } from "../../state/SettingsContext";
import type { ThemeColors } from "../../theme/colors";
import { ExercisePrompt } from "../components/ExercisePrompt";
import { ExplanationPanel } from "../components/ExplanationPanel";
import { VimEditor } from "../components/VimEditor";
import type { VimEditorHandle } from "../components/VimEditor";

type Props = NativeStackScreenProps<RootStackParamList, "VimExercise">;

/**
 * Vim演習画面(docs/requirements.md 3章5節・9章2、docs/vim-simulator-design.md 7章): モード表示・
 * キー入力ログ・現在のバッファ内容を持つ`VimEditor`を使い、演習文・ヒント・答え合わせ・解説を表示する。
 * 答え合わせは、`src/engine/vim`エンジンを使って学習者が実際に編集した最終的なバッファ内容を、
 * 演習の期待バッファ内容(`expectedFileText`)と突き合わせる方式で行う。
 */
export function VimExerciseScreen({ route }: Props) {
  const exercise = exercises.find((item) => item.id === route.params.exerciseId);
  const { recordAttempt } = useProgress();
  const { colors } = useSettings();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.bottom), [colors, insets.bottom]);
  const editorRef = useRef<VimEditorHandle>(null);
  const [visibleHintCount, setVisibleHintCount] = useState(0);
  const [passed, setPassed] = useState<boolean | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  if (!exercise || exercise.type !== "vim" || !exercise.initialFileText) {
    return (
      <View style={styles.container}>
        <Text style={styles.prompt}>演習が見つかりませんでした。</Text>
      </View>
    );
  }

  const hints = exercise.hints ?? [];

  function handleShowHint() {
    setVisibleHintCount((count) => Math.min(count + 1, hints.length));
  }

  function handleCheckAnswer() {
    if (!exercise?.expectedFileText) return;

    const bufferText = editorRef.current?.getBufferText() ?? "";
    const result = compareText(exercise.expectedFileText, bufferText);
    setPassed(result.match);
    setShowExplanation(false);
    recordAttempt(exercise.id, result.match);
  }

  const canShowExplanation = Boolean(exercise.referenceSolution);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.header} contentContainerStyle={styles.headerContent}>
        <ExercisePrompt prompt={exercise.prompt} promptSteps={exercise.promptSteps} />
        {hints.slice(0, visibleHintCount).map((hint, index) => (
          <Text key={hint} style={styles.hint}>
            ヒント{index + 1}: {hint}
          </Text>
        ))}
        {passed !== null && (
          <Text style={passed ? styles.resultPass : styles.resultFail}>
            {passed ? "正解です!" : "不正解です。もう一度試してみましょう。"}
          </Text>
        )}
        {showExplanation && exercise.referenceSolution && (
          <ExplanationPanel
            referenceSolution={exercise.referenceSolution}
            explanation={exercise.explanation}
          />
        )}
      </ScrollView>

      <VimEditor ref={editorRef} initialFileText={exercise.initialFileText} />

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
          style={[styles.actionButton, styles.primaryButton]}
          onPress={handleCheckAnswer}
          disabled={!exercise.expectedFileText}
        >
          <Text style={[styles.actionButtonText, styles.primaryButtonText]}>答え合わせ</Text>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={() => setShowExplanation((current) => !current)}
          disabled={!canShowExplanation}
        >
          <Text style={styles.actionButtonText}>
            {showExplanation ? "解答・解説を隠す" : "解答・解説を見る"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors, bottomInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { maxHeight: 160 },
    headerContent: { padding: 16, gap: 8 },
    prompt: { fontSize: 16, color: colors.text },
    hint: { fontSize: 14, color: colors.textSecondary },
    resultPass: { fontSize: 15, fontWeight: "600", color: colors.success },
    resultFail: { fontSize: 15, fontWeight: "600", color: colors.danger },
    actions: {
      flexDirection: "row",
      padding: 12,
      paddingBottom: 12 + bottomInset,
      gap: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    actionButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: "center",
      backgroundColor: colors.chip,
    },
    actionButtonText: { fontSize: 14, fontWeight: "600", color: colors.text },
    primaryButton: { backgroundColor: colors.primary },
    primaryButtonText: { color: colors.primaryContrast },
  });
}
