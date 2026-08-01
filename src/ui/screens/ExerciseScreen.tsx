import { StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { exercises } from "../../content/exercises";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Exercise">;

export function ExerciseScreen({ route }: Props) {
  const exercise = exercises.find((item) => item.id === route.params.exerciseId);

  return (
    <View style={styles.container}>
      <Text style={styles.prompt}>
        {exercise?.prompt ?? "演習が見つかりませんでした。"}
      </Text>
      {/* 仮想ターミナル(engine/ を利用したコマンド実行・採点)はここに実装していく */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  prompt: { fontSize: 16 },
});
