import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { ChapterListScreen } from "../ui/screens/ChapterListScreen";
import { ExerciseScreen } from "../ui/screens/ExerciseScreen";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="ChapterList">
        <Stack.Screen
          name="ChapterList"
          component={ChapterListScreen}
          options={{ title: "章一覧" }}
        />
        <Stack.Screen
          name="Exercise"
          component={ExerciseScreen}
          options={{ title: "演習" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
