import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ProgressProvider } from "../state/ProgressContext";
import { useSettings } from "../state/SettingsContext";
import { getNavigationTheme } from "../theme/navigationTheme";
import { ChapterListScreen } from "../ui/screens/ChapterListScreen";
import { ExerciseScreen } from "../ui/screens/ExerciseScreen";
import { GitExerciseScreen } from "../ui/screens/GitExerciseScreen";
import { HelpScreen } from "../ui/screens/HelpScreen";
import { MyPageScreen } from "../ui/screens/MyPageScreen";
import { QuizExerciseScreen } from "../ui/screens/QuizExerciseScreen";
import { ScriptExerciseScreen } from "../ui/screens/ScriptExerciseScreen";
import { SettingsScreen } from "../ui/screens/SettingsScreen";
import { UnitDetailScreen } from "../ui/screens/UnitDetailScreen";
import { VimExerciseScreen } from "../ui/screens/VimExerciseScreen";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { resolvedTheme, colors } = useSettings();

  return (
    <ProgressProvider>
      <NavigationContainer theme={getNavigationTheme(resolvedTheme)}>
        <Stack.Navigator initialRouteName="ChapterList">
          <Stack.Screen
            name="ChapterList"
            component={ChapterListScreen}
            options={({ navigation }) => ({
              title: "章一覧",
              headerRight: () => {
                const headerButtonTextStyle = [styles.headerButtonText, { color: colors.primary }];
                return (
                  <View style={styles.headerButtonRow}>
                    <Pressable hitSlop={8} onPress={() => navigation.navigate("Help")}>
                      <Text style={headerButtonTextStyle}>使い方</Text>
                    </Pressable>
                    <Pressable hitSlop={8} onPress={() => navigation.navigate("MyPage")}>
                      <Text style={headerButtonTextStyle}>マイページ</Text>
                    </Pressable>
                  </View>
                );
              },
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
            name="GitExercise"
            component={GitExerciseScreen}
            options={{ title: "Git演習" }}
          />
          <Stack.Screen
            name="MyPage"
            component={MyPageScreen}
            options={{ title: "マイページ" }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: "表示設定" }}
          />
          <Stack.Screen
            name="Help"
            component={HelpScreen}
            options={{ title: "使い方" }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </ProgressProvider>
  );
}

const styles = StyleSheet.create({
  headerButtonRow: { flexDirection: "row", alignItems: "center", gap: 24 },
  headerButtonText: { fontSize: 14, fontWeight: "600" },
});
