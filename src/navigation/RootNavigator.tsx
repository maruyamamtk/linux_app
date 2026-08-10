import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { ProgressProvider } from "../state/ProgressContext";
import { ChapterListScreen } from "../ui/screens/ChapterListScreen";
import { ExerciseScreen } from "../ui/screens/ExerciseScreen";
import { ScriptExerciseScreen } from "../ui/screens/ScriptExerciseScreen";
import { UnitDetailScreen } from "../ui/screens/UnitDetailScreen";
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
            options={{ title: "章一覧" }}
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
        </Stack.Navigator>
      </NavigationContainer>
    </ProgressProvider>
  );
}
