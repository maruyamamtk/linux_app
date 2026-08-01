import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { chapters } from "../../content/chapters";
import { exercises } from "../../content/exercises";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "ChapterList">;

export function ChapterListScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <FlatList
        data={chapters}
        keyExtractor={(chapter) => chapter.id}
        renderItem={({ item: chapter }) => {
          const firstExercise = exercises.find(
            (exercise) => exercise.chapterId === chapter.id,
          );
          return (
            <Pressable
              style={styles.row}
              disabled={!firstExercise}
              onPress={() =>
                firstExercise &&
                navigation.navigate("Exercise", {
                  chapterId: chapter.id,
                  exerciseId: firstExercise.id,
                })
              }
            >
              <Text style={styles.title}>{chapter.title}</Text>
              <Text style={styles.phase}>Phase {chapter.phase}</Text>
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
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ccc",
  },
  title: { fontSize: 16 },
  phase: { fontSize: 12, color: "#888" },
});
