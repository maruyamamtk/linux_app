import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { chapters } from "../../content/chapters";
import { exercises } from "../../content/exercises";
import type { RootStackParamList } from "../../navigation/types";
import { useProgress } from "../../state/ProgressContext";
import { ProgressBar } from "../components/ProgressBar";

type Props = NativeStackScreenProps<RootStackParamList, "ChapterList">;

/**
 * ホーム/章一覧画面(docs/requirements.md 5章1節): 章ごとの進捗率とPhaseバッジを表示し、
 * タップでユニット詳細画面へ遷移する。
 */
export function ChapterListScreen({ navigation }: Props) {
  const { isCleared } = useProgress();

  return (
    <View style={styles.container}>
      <FlatList
        data={chapters}
        keyExtractor={(chapter) => chapter.id}
        renderItem={({ item: chapter }) => {
          const chapterExercises = exercises.filter(
            (exercise) => exercise.chapterId === chapter.id,
          );
          const clearedCount = chapterExercises.filter((exercise) => isCleared(exercise.id)).length;
          const progress = chapterExercises.length > 0 ? clearedCount / chapterExercises.length : 0;

          return (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate("UnitDetail", { chapterId: chapter.id })}
            >
              <View style={styles.rowHeader}>
                <Text style={styles.title}>{chapter.title}</Text>
                <Text style={styles.phase}>Phase {chapter.phase}</Text>
              </View>
              {chapterExercises.length > 0 ? (
                <>
                  <ProgressBar progress={progress} />
                  <Text style={styles.progressLabel}>
                    {clearedCount}/{chapterExercises.length} 完了 ({Math.round(progress * 100)}%)
                  </Text>
                </>
              ) : (
                <Text style={styles.comingSoon}>準備中</Text>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ccc",
    gap: 6,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 16 },
  phase: { fontSize: 12, color: "#888" },
  progressLabel: { fontSize: 12, color: "#57606a" },
  comingSoon: { fontSize: 12, color: "#888" },
});
