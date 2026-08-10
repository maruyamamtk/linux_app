import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { chapters } from "../../content/chapters";
import { exercises } from "../../content/exercises";
import type { RootStackParamList } from "../../navigation/types";
import { useProgress } from "../../state/ProgressContext";
import { ProgressBar } from "../components/ProgressBar";

type Props = NativeStackScreenProps<RootStackParamList, "UnitDetail">;

/**
 * ユニット詳細画面(docs/requirements.md 5章2節): 章内の演習リストと
 * ミニ解説テキストを表示する。演習をタップすると該当のExercise/ScriptExercise画面へ遷移する。
 */
export function UnitDetailScreen({ navigation, route }: Props) {
  const { isCleared } = useProgress();
  const chapter = chapters.find((item) => item.id === route.params.chapterId);
  const chapterExercises = exercises.filter(
    (exercise) => exercise.chapterId === route.params.chapterId,
  );
  const clearedCount = chapterExercises.filter((exercise) => isCleared(exercise.id)).length;
  const progress = chapterExercises.length > 0 ? clearedCount / chapterExercises.length : 0;

  if (!chapter) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>章が見つかりませんでした。</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{chapter.title}</Text>
          <Text style={styles.phase}>Phase {chapter.phase}</Text>
        </View>
        <Text style={styles.description}>{chapter.description}</Text>
        {chapterExercises.length > 0 && (
          <>
            <ProgressBar progress={progress} />
            <Text style={styles.progressLabel}>
              {clearedCount}/{chapterExercises.length} 完了 ({Math.round(progress * 100)}%)
            </Text>
          </>
        )}
      </View>

      <FlatList
        data={chapterExercises}
        keyExtractor={(exercise) => exercise.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>この章の演習は準備中です。</Text>}
        renderItem={({ item: exercise, index }) => {
          const cleared = isCleared(exercise.id);
          return (
            <Pressable
              style={styles.row}
              onPress={() => {
                const screen =
                  exercise.type === "script"
                    ? "ScriptExercise"
                    : exercise.type === "quiz"
                      ? "QuizExercise"
                      : "Exercise";
                navigation.navigate(screen, {
                  chapterId: exercise.chapterId,
                  exerciseId: exercise.id,
                });
              }}
            >
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>演習 {index + 1}</Text>
                <Text style={styles.rowPrompt} numberOfLines={2}>
                  {exercise.prompt}
                </Text>
              </View>
              <Text style={[styles.badge, cleared ? styles.badgeCleared : styles.badgePending]}>
                {cleared ? "完了" : "未完了"}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    padding: 16,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ccc",
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "700" },
  phase: { fontSize: 12, color: "#888" },
  description: { fontSize: 14, color: "#444", lineHeight: 20 },
  progressLabel: { fontSize: 12, color: "#57606a" },
  list: { flexGrow: 1 },
  empty: { padding: 16, fontSize: 14, color: "#888" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ccc",
    gap: 12,
  },
  rowTextWrap: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: "600" },
  rowPrompt: { fontSize: 13, color: "#57606a" },
  badge: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: "hidden",
  },
  badgeCleared: { backgroundColor: "#1a7f37", color: "#fff" },
  badgePending: { backgroundColor: "#eee", color: "#57606a" },
});
