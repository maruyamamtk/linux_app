import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { exercises } from "../../content/exercises";
import { phase1VfsSnapshot } from "../../content/vfsSeed";
import { gradeScriptTestCases } from "../../engine/grading";
import type { ScriptTestCaseResult } from "../../engine/grading";
import type { VfsUser } from "../../engine/vfs";
import type { RootStackParamList } from "../../navigation/types";
import { useProgress } from "../../state/ProgressContext";
import { useSettings } from "../../state/SettingsContext";
import type { ThemeColors } from "../../theme/colors";
import { CodeEditor } from "../components/CodeEditor";
import { ExplanationPanel } from "../components/ExplanationPanel";
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
  const { recordAttempt } = useProgress();
  const { colors } = useSettings();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.bottom), [colors, insets.bottom]);
  const [visibleHintCount, setVisibleHintCount] = useState(0);
  const [script, setScript] = useState(() => exercise?.initialScript ?? "#!/bin/bash\n");
  const [results, setResults] = useState<ScriptTestCaseResult[] | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

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
    setShowExplanation(false);
    if (graded.length > 0) {
      recordAttempt(exercise.id, graded.every((result) => result.grade.passed));
    }
  }

  const canShowExplanation = results !== null && results.length > 0 && !results.every((result) => result.grade.passed);

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

      <View style={[styles.actions, !results && styles.actionsNoResults]}>
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
        <Pressable
          style={styles.actionButton}
          onPress={() => setShowExplanation(true)}
          disabled={!canShowExplanation || showExplanation}
        >
          <Text style={styles.actionButtonText}>解答・解説を見る</Text>
        </Pressable>
      </View>

      {results && (
        <ScrollView style={styles.resultsScroll} contentContainerStyle={styles.resultsContent}>
          <TestCaseResultPanel results={results} />
          {showExplanation && exercise.referenceSolution && (
            <ExplanationPanel
              referenceSolution={exercise.referenceSolution}
              explanation={exercise.explanation}
            />
          )}
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors, bottomInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { maxHeight: 140 },
    headerContent: { padding: 16, gap: 8 },
    prompt: { fontSize: 16, color: colors.text },
    hint: { fontSize: 14, color: colors.textSecondary },
    actions: {
      flexDirection: "row",
      padding: 12,
      gap: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    // resultsが表示されない(=このactions行が画面最下部になる)場合のみ、
    // Android edge-to-edge(SDK54で強制有効)を考慮した余白を追加する。
    actionsNoResults: { paddingBottom: 12 + bottomInset },
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
    resultsScroll: {
      maxHeight: 260,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    resultsContent: { padding: 12, paddingBottom: 12 + bottomInset },
  });
}
