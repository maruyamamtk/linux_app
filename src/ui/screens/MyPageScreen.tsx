import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { chapters } from "../../content/chapters";
import { exercises } from "../../content/exercises";
import type { RootStackParamList } from "../../navigation/types";
import { useProgress } from "../../state/ProgressContext";
import { ProgressBar } from "../components/ProgressBar";

type Props = NativeStackScreenProps<RootStackParamList, "MyPage">;

/**
 * 進捗/マイページ画面(docs/requirements.md 5章7節): 章別クリア状況と、
 * 直近の判定が不正解のままの演習(要復習)の一覧を表示する。
 */
export function MyPageScreen({ navigation }: Props) {
  const { isCleared, reviewExerciseIds } = useProgress();

  const reviewExercises = exercises.filter((exercise) => reviewExerciseIds.has(exercise.id));

  return (
    <View style={styles.container}>
      <FlatList
        data={chapters}
        keyExtractor={(chapter) => chapter.id}
        ListHeaderComponent={<Text style={styles.sectionTitle}>章別クリア状況</Text>}
        renderItem={({ item: chapter }) => {
          const chapterExercises = exercises.filter(
            (exercise) => exercise.chapterId === chapter.id,
          );
          const clearedCount = chapterExercises.filter((exercise) => isCleared(exercise.id)).length;
          const progress = chapterExercises.length > 0 ? clearedCount / chapterExercises.length : 0;

          return (
            <View style={styles.row}>
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
            </View>
          );
        }}
        ListFooterComponent={
          <View style={styles.reviewSection}>
            <Text style={styles.sectionTitle}>間違えた演習の復習リスト</Text>
            {reviewExercises.length === 0 ? (
              <Text style={styles.empty}>復習が必要な演習はありません。</Text>
            ) : (
              reviewExercises.map((exercise) => (
                <Pressable
                  key={exercise.id}
                  style={styles.reviewRow}
                  onPress={() =>
                    navigation.navigate(exercise.type === "script" ? "ScriptExercise" : "Exercise", {
                      chapterId: exercise.chapterId,
                      exerciseId: exercise.id,
                    })
                  }
                >
                  <Text style={styles.rowPrompt} numberOfLines={2}>
                    {exercise.prompt}
                  </Text>
                  <Text style={styles.badgeReview}>要復習</Text>
                </Pressable>
              ))
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#57606a",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
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
  reviewSection: { paddingBottom: 16 },
  empty: { paddingHorizontal: 16, fontSize: 13, color: "#888" },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ccc",
    gap: 12,
  },
  rowPrompt: { flex: 1, fontSize: 13, color: "#24292f" },
  badgeReview: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "#fff1e5",
    color: "#bc4c00",
    overflow: "hidden",
  },
});
