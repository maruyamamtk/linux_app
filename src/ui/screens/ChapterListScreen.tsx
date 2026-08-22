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

type Props = NativeStackScreenProps<RootStackParamList, "ChapterList">;

/**
 * ホーム/章一覧画面(docs/requirements.md 5章1節): 章ごとの進捗率を表示し、
 * タップでユニット詳細画面へ遷移する。
 */
export function ChapterListScreen({ navigation }: Props) {
  const { isCleared } = useProgress();
  const { colors } = useSettings();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
  });
}
