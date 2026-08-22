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

type Props = NativeStackScreenProps<RootStackParamList, "UnitDetail">;

/**
 * ユニット詳細画面(docs/requirements.md 5章2節): 章内の演習リストと
 * ミニ解説テキストを表示する。演習をタップすると該当のExercise/ScriptExercise画面へ遷移する。
 */
export function UnitDetailScreen({ navigation, route }: Props) {
  const { isCleared, getStatus } = useProgress();
  const { colors } = useSettings();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
        <Text style={styles.title}>{chapter.title}</Text>
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
          const status = getStatus(exercise.id);
          const badgeLabel =
            status === "正解" ? "正解済み" : status === "要復習" ? "要復習" : "未着手";
          const badgeStyle =
            status === "正解"
              ? styles.badgeCorrect
              : status === "要復習"
                ? styles.badgeReview
                : styles.badgePending;
          return (
            <Pressable
              style={styles.row}
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
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>演習 {index + 1}</Text>
                <Text style={styles.rowPrompt} numberOfLines={2}>
                  {exercise.prompt}
                </Text>
              </View>
              <Text style={[styles.badge, badgeStyle]}>{badgeLabel}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      padding: 16,
      gap: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: { fontSize: 20, fontWeight: "700", color: colors.text },
    description: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
    progressLabel: { fontSize: 12, color: colors.textSecondary },
    list: { flexGrow: 1 },
    empty: { padding: 16, fontSize: 14, color: colors.textMuted },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 12,
    },
    rowTextWrap: { flex: 1, gap: 2 },
    rowTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
    rowPrompt: { fontSize: 13, color: colors.textSecondary },
    badge: {
      fontSize: 11,
      fontWeight: "700",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      overflow: "hidden",
    },
    badgeCorrect: { backgroundColor: colors.successBg, color: colors.success },
    badgeReview: { backgroundColor: colors.warningBg, color: colors.warning },
    badgePending: { backgroundColor: colors.chip, color: colors.textSecondary },
  });
}
