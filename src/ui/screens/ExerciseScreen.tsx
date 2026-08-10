import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { exercises } from "../../content/exercises";
import { phase1VfsSnapshot } from "../../content/vfsSeed";
import { gradeExercise } from "../../engine/grading";
import type { GradeResult } from "../../engine/grading";
import type { VfsUser } from "../../engine/vfs";
import type { RootStackParamList } from "../../navigation/types";
import { useProgress } from "../../state/ProgressContext";
import { ExplanationPanel } from "../components/ExplanationPanel";
import { Terminal } from "../components/Terminal";
import type { TerminalHandle } from "../components/Terminal";

type Props = NativeStackScreenProps<RootStackParamList, "Exercise">;

const STUDY_USER: VfsUser = { name: "study", groups: ["study"] };
const HOME_DIR = "/home/study";

export function ExerciseScreen({ route }: Props) {
  const exercise = exercises.find((item) => item.id === route.params.exerciseId);
  const { recordAttempt } = useProgress();
  const terminalRef = useRef<TerminalHandle>(null);
  const [visibleHintCount, setVisibleHintCount] = useState(0);
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  if (!exercise) {
    return (
      <View style={styles.container}>
        <Text style={styles.prompt}>演習が見つかりませんでした。</Text>
      </View>
    );
  }

  const initialCwd = exercise.initialCwd ?? HOME_DIR;
  const hints = exercise.hints ?? [];

  function handleShowHint() {
    setVisibleHintCount((count) => Math.min(count + 1, hints.length));
  }

  function handleCheckAnswer() {
    if (!exercise?.referenceSolution) return;

    const userInput = terminalRef.current?.getLastCommand() ?? "";
    const result = gradeExercise({
      snapshot: phase1VfsSnapshot,
      user: STUDY_USER,
      cwd: initialCwd,
      env: { HOME: HOME_DIR, PATH: "/bin:/usr/bin" },
      processes: exercise.processes,
      userInput,
      referenceSolution: exercise.referenceSolution,
    });
    setGradeResult(result);
    setShowExplanation(false);
    recordAttempt(exercise.id, result.passed);
  }

  const canShowExplanation = gradeResult !== null && !gradeResult.passed;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.header} contentContainerStyle={styles.headerContent}>
        <Text style={styles.prompt}>{exercise.prompt}</Text>
        {hints.slice(0, visibleHintCount).map((hint, index) => (
          <Text key={hint} style={styles.hint}>
            ヒント{index + 1}: {hint}
          </Text>
        ))}
        {gradeResult && (
          <Text style={gradeResult.passed ? styles.resultPass : styles.resultFail}>
            {gradeResult.passed ? "正解です!" : "不正解です。もう一度試してみましょう。"}
          </Text>
        )}
        {showExplanation && exercise.referenceSolution && (
          <ExplanationPanel
            referenceSolution={exercise.referenceSolution}
            explanation={exercise.explanation}
          />
        )}
      </ScrollView>

      <Terminal
        ref={terminalRef}
        snapshot={phase1VfsSnapshot}
        user={STUDY_USER}
        initialCwd={initialCwd}
        initialEnv={{ HOME: HOME_DIR }}
        processes={exercise.processes}
      />

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
          disabled={!exercise.referenceSolution}
        >
          <Text style={[styles.actionButtonText, styles.primaryButtonText]}>答え合わせ</Text>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={() => setShowExplanation(true)}
          disabled={!canShowExplanation || showExplanation}
        >
          <Text style={styles.actionButtonText}>解答・解説を見る</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { maxHeight: 160 },
  headerContent: { padding: 16, gap: 8 },
  prompt: { fontSize: 16 },
  hint: { fontSize: 14, color: "#555" },
  resultPass: { fontSize: 15, fontWeight: "600", color: "#1a7f37" },
  resultFail: { fontSize: 15, fontWeight: "600", color: "#cf222e" },
  actions: {
    flexDirection: "row",
    padding: 12,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ccc",
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#eee",
  },
  actionButtonText: { fontSize: 14, fontWeight: "600", color: "#333" },
  primaryButton: { backgroundColor: "#1a7f37" },
  primaryButtonText: { color: "#fff" },
});
