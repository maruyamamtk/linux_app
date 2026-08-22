import { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { chapters } from "../../content/chapters";
import { exercises } from "../../content/exercises";
import type { RootStackParamList } from "../../navigation/types";
import { useProgress } from "../../state/ProgressContext";
import { useSettings } from "../../state/SettingsContext";
import type { ThemeColors } from "../../theme/colors";
import { ProgressBar } from "../components/ProgressBar";

type Props = NativeStackScreenProps<RootStackParamList, "MyPage">;

/**
 * 進捗/マイページ画面(docs/requirements.md 5章7節): 章別クリア状況と、
 * 直近の判定が不正解のままの演習(要復習)の一覧、および表示設定画面への導線を表示する。
 */
export function MyPageScreen({ navigation }: Props) {
  const { isCleared, reviewExerciseIds } = useProgress();
  const { colors } = useSettings();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
              <Text style={styles.title}>{chapter.title}</Text>
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
          <>
            <View style={styles.reviewSection}>
              <Text style={styles.sectionTitle}>間違えた演習の復習リスト</Text>
              {reviewExercises.length === 0 ? (
                <Text style={styles.empty}>復習が必要な演習はありません。</Text>
              ) : (
                reviewExercises.map((exercise) => (
                  <Pressable
                    key={exercise.id}
                    style={styles.reviewRow}
                    onPress={() => {
                      const screen =
                        exercise.type === "script"
                          ? "ScriptExercise"
                          : exercise.type === "quiz"
                            ? "QuizExercise"
                            : exercise.type === "vim"
                              ? "VimExercise"
                              : exercise.type === "git"
                                ? "GitExercise"
                                : "Exercise";
                      navigation.navigate(screen, {
                        chapterId: exercise.chapterId,
                        exerciseId: exercise.id,
                      });
                    }}
                  >
                    <Text style={styles.rowPrompt} numberOfLines={2}>
                      {exercise.prompt}
                    </Text>
                    <Text style={styles.badgeReview}>要復習</Text>
                  </Pressable>
                ))
              )}
            </View>
            <Pressable style={styles.settingsRow} onPress={() => navigation.navigate("Settings")}>
              <Text style={styles.settingsRowText}>表示設定(テーマ・フォントサイズ)</Text>
              <Text style={styles.settingsRowChevron}>›</Text>
            </Pressable>
          </>
        }
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textSecondary,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    row: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 6,
    },
    title: { fontSize: 16, color: colors.text },
    progressLabel: { fontSize: 12, color: colors.textSecondary },
    comingSoon: { fontSize: 12, color: colors.textMuted },
    reviewSection: { paddingBottom: 8 },
    empty: { paddingHorizontal: 16, fontSize: 13, color: colors.textMuted },
    reviewRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 12,
    },
    rowPrompt: { flex: 1, fontSize: 13, color: colors.text },
    badgeReview: {
      fontSize: 11,
      fontWeight: "700",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      backgroundColor: colors.warningBg,
      color: colors.warning,
      overflow: "hidden",
    },
    settingsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 8,
      marginHorizontal: 16,
      marginBottom: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    settingsRowText: { fontSize: 14, fontWeight: "600", color: colors.text },
    settingsRowChevron: { fontSize: 18, color: colors.textMuted },
  });
}
