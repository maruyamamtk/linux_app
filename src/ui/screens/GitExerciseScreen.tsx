import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { CommandContext } from "../../engine/commands";
import { exercises } from "../../content/exercises";
import { phase1VfsSnapshot } from "../../content/vfsSeed";
import { buildCommitGraph, findRepoRoot } from "../../engine/git";
import type { CommitGraph } from "../../engine/git";
import { gradeExercise } from "../../engine/grading";
import type { GradeResult } from "../../engine/grading";
import type { VfsUser } from "../../engine/vfs";
import type { RootStackParamList } from "../../navigation/types";
import { useProgress } from "../../state/ProgressContext";
import { CommitGraphView } from "../components/CommitGraphView";
import { ExplanationPanel } from "../components/ExplanationPanel";
import { Terminal } from "../components/Terminal";
import type { TerminalHandle } from "../components/Terminal";

type Props = NativeStackScreenProps<RootStackParamList, "GitExercise">;

const STUDY_USER: VfsUser = { name: "study", groups: ["study"] };
const HOME_DIR = "/home/study";
const EMPTY_GRAPH: CommitGraph = { nodes: [], headBranch: undefined };

/**
 * Git演習画面(docs/requirements.md 5章6節、docs/git-simulator-design.md 10章): 既存の
 * `Terminal`をそのまま再利用して`git`コマンドの入力を受け付けつつ、脇に現在のリポジトリの
 * コミットグラフを表示する`CommitGraphView`パネルを追加する。Gitコマンドは他のcoreutils風
 * コマンドと同じ`CommandHandler`として実装されているため(2章)、専用の入力UIは不要で、
 * `Terminal`からコマンド実行のたびに渡される`CommandContext`をもとにグラフを再構築するだけでよい。
 */
export function GitExerciseScreen({ route }: Props) {
  const exercise = exercises.find((item) => item.id === route.params.exerciseId);
  const { recordAttempt } = useProgress();
  const terminalRef = useRef<TerminalHandle>(null);
  const [visibleHintCount, setVisibleHintCount] = useState(0);
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [graph, setGraph] = useState<CommitGraph>(EMPTY_GRAPH);

  const handleCommandExecuted = useCallback((context: CommandContext) => {
    const repoRoot = findRepoRoot(context.vfs, context.cwd);
    setGraph(repoRoot ? buildCommitGraph(context.vfs, repoRoot) : EMPTY_GRAPH);
  }, []);

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

      <View style={styles.graphPanel}>
        <Text style={styles.graphTitle}>コミットグラフ</Text>
        <ScrollView>
          <CommitGraphView graph={graph} />
        </ScrollView>
      </View>

      <Terminal
        ref={terminalRef}
        snapshot={phase1VfsSnapshot}
        user={STUDY_USER}
        initialCwd={initialCwd}
        initialEnv={{ HOME: HOME_DIR }}
        processes={exercise.processes}
        onCommandExecuted={handleCommandExecuted}
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
  header: { maxHeight: 140 },
  headerContent: { padding: 16, gap: 8 },
  prompt: { fontSize: 16 },
  hint: { fontSize: 14, color: "#555" },
  resultPass: { fontSize: 15, fontWeight: "600", color: "#1a7f37" },
  resultFail: { fontSize: 15, fontWeight: "600", color: "#cf222e" },
  graphPanel: {
    maxHeight: 180,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#ccc",
    backgroundColor: "#f6f8fa",
  },
  graphTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#57606a",
    paddingHorizontal: 12,
    paddingTop: 8,
  },
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
