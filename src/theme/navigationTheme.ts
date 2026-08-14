import { DarkTheme, DefaultTheme } from "@react-navigation/native";
import type { Theme } from "@react-navigation/native";

import { darkColors, lightColors } from "./colors";

/** `NavigationContainer`用のテーマ(ヘッダー・画面背景の既定色)を解決する。 */
export function getNavigationTheme(resolvedTheme: "light" | "dark"): Theme {
  const colors = resolvedTheme === "dark" ? darkColors : lightColors;
  const base = resolvedTheme === "dark" ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };
}
