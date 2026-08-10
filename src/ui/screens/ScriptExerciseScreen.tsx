import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { exercises } from "../../content/exercises";
import { phase1VfsSnapshot } from "../../content/vfsSeed";
import { gradeScriptTestCases } from "../../engine/grading";
import type { ScriptTestCaseResult } from "../../engine/grading";
import type { VfsUser } from "../../engine/vfs";
import type { RootStackParamList } from "../../navigation/types";
import { useProgress } from "../../state/ProgressContext";
import { CodeEditor } from "../components/CodeEditor";
import { TestCaseResultPanel } from "../components/TestCaseResultPanel";

type Props = NativeStackScreenProps<RootStackParamList, "ScriptExercise">;

const STUDY_USER: VfsUser = { name: "study", groups: ["study"] };
const HOME_DIR = "/home/study";

/**
 * スクリプト作成モード画面(docs/requirements.md 3章8節・5章4): コードエディタ+
 * 複数テストケースの実行・合否表示パネル。判定ロジックは持たず、`engine/grading` の
 * `gradeScriptTestCases` にテストケースごとの採点を委譲する。
 */
export function ScriptExerciseScreen({ route }: Props) {
  const exercise = exercises.find((item) => item.id === route.params.exerciseId);
  const { markCleared } = useProgress();
  const [visibleHintCount, setVisibleHintCount] = useState(0);
  const [script, setScript] = useState(() => exercise?.initialScript ?? "#!/bin/bash\n");
  const [results, setResults] = useState<ScriptTestCaseResult[] | null>(null);

  if (!exercise || exercise.type !== "script") {
    return (
      <View style={styles.container}>
        <Text style={styles.prompt}>演習が見つかりませんでした。</Text>
      </View>
    );
  }

  const initialCwd = exercise.initialCwd ?? HOME_DIR;
  const hints = exercise.hints ?? [];
  const testCases = exercise.testCases ?? [];

  function handleShowHint() {
    setVisibleHintCount((count) => Math.min(count + 1, hints.length));
  }

  function handleRunTests() {
    if (!exercise?.referenceSolution || testCases.length === 0) return;

    const graded = gradeScriptTestCases(
      {
        snapshot: phase1VfsSnapshot,
        user: STUDY_USER,
        cwd: initialCwd,
        env: { HOME: HOME_DIR, PATH: "/bin:/usr/bin" },
        userInput: script,
        referenceSolution: exercise.referenceSolution,
      },
      testCases,
    );
    setResults(graded);
    if (graded.length > 0 && graded.every((result) => result.grade.passed)) {
      markCleared(exercise.id);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.header} contentContainerStyle={styles.headerContent}>
        <Text style={styles.prompt}>{exercise.prompt}</Text>
        {hints.slice(0, visibleHintCount).map((hint, index) => (
          <Text key={hint} style={styles.hint}>
            ヒント{index + 1}: {hint}
          </Text>
        ))}
      </ScrollView>

      <CodeEditor value={script} onChangeText={setScript} placeholder="#!/bin/bash" />

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
          onPress={handleRunTests}
          disabled={!exercise.referenceSolution || testCases.length === 0}
        >
          <Text style={[styles.actionButtonText, styles.primaryButtonText]}>テストを実行</Text>
        </Pressable>
      </View>

      {results && (
        <ScrollView style={styles.resultsScroll} contentContainerStyle={styles.resultsContent}>
          <TestCaseResultPanel results={results} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { maxHeight: 140 },
  headerContent: { padding: 16, gap: 8 },
  prompt: { fontSize: 16 },
  hint: { fontSize: 14, color: "#555" },
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
  resultsScroll: { maxHeight: 260, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#ccc" },
  resultsContent: { padding: 12 },
});
