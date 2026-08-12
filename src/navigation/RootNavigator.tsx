import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text } from "react-native";

import { ProgressProvider } from "../state/ProgressContext";
import { ChapterListScreen } from "../ui/screens/ChapterListScreen";
import { ExerciseScreen } from "../ui/screens/ExerciseScreen";
import { MyPageScreen } from "../ui/screens/MyPageScreen";
import { QuizExerciseScreen } from "../ui/screens/QuizExerciseScreen";
import { ScriptExerciseScreen } from "../ui/screens/ScriptExerciseScreen";
import { UnitDetailScreen } from "../ui/screens/UnitDetailScreen";
import { VimExerciseScreen } from "../ui/screens/VimExerciseScreen";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <ProgressProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="ChapterList">
          <Stack.Screen
            name="ChapterList"
            component={ChapterListScreen}
            options={({ navigation }) => ({
              title: "章一覧",
              headerRight: () => (
                <Pressable onPress={() => navigation.navigate("MyPage")}>
                  <Text style={styles.headerButtonText}>マイページ</Text>
                </Pressable>
              ),
            })}
          />
          <Stack.Screen
            name="UnitDetail"
            component={UnitDetailScreen}
            options={{ title: "ユニット詳細" }}
          />
          <Stack.Screen
            name="Exercise"
            component={ExerciseScreen}
            options={{ title: "演習" }}
          />
          <Stack.Screen
            name="ScriptExercise"
            component={ScriptExerciseScreen}
            options={{ title: "スクリプト作成" }}
          />
          <Stack.Screen
            name="QuizExercise"
            component={QuizExerciseScreen}
            options={{ title: "クイズ" }}
          />
          <Stack.Screen
            name="VimExercise"
            component={VimExerciseScreen}
            options={{ title: "Vim演習" }}
          />
          <Stack.Screen
            name="MyPage"
            component={MyPageScreen}
            options={{ title: "マイページ" }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </ProgressProvider>
  );
}

const styles = StyleSheet.create({
  headerButtonText: { fontSize: 14, color: "#1a7f37", fontWeight: "600" },
});
