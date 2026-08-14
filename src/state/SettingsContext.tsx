import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  DEFAULT_DISPLAY_SETTINGS,
  clampTerminalFontSize,
  parseStoredDisplaySettings,
  serializeDisplaySettings,
} from "./settings";
import type { DisplaySettings, ThemeMode } from "./settings";
import { darkColors, lightColors } from "../theme/colors";
import type { ThemeColors } from "../theme/colors";

const STORAGE_KEY = "linuxdojo.settings.display.v1";

type SettingsContextValue = {
  themeMode: ThemeMode;
  /** `themeMode`が"system"の場合は端末の配色設定から解決した実際のテーマ。 */
  resolvedTheme: "light" | "dark";
  colors: ThemeColors;
  terminalFontSize: number;
  setThemeMode: (mode: ThemeMode) => void;
  setTerminalFontSize: (size: number) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * 表示設定(テーマ・ターミナルのフォントサイズ、docs/requirements.md 7章)を保持し、
 * AsyncStorageへ永続化するコンテキスト。`ProgressContext`と同様のパターンで実装している。
 * `RootNavigator`より外側でラップし、`NavigationContainer`のテーマ切り替えにも使う。
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULT_DISPLAY_SETTINGS);
  const systemColorScheme = useColorScheme();

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        setSettings(parseStoredDisplaySettings(stored));
      })
      .catch(() => {
        // 保存データの読み込みに失敗した場合は初期設定のまま続行する
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function persist(next: DisplaySettings) {
    setSettings(next);
    AsyncStorage.setItem(STORAGE_KEY, serializeDisplaySettings(next)).catch(() => {});
  }

  function setThemeMode(themeMode: ThemeMode) {
    persist({ ...settings, themeMode });
  }

  function setTerminalFontSize(size: number) {
    persist({ ...settings, terminalFontSize: clampTerminalFontSize(size) });
  }

  const resolvedTheme: "light" | "dark" =
    settings.themeMode === "system"
      ? systemColorScheme === "dark"
        ? "dark"
        : "light"
      : settings.themeMode;

  const value = useMemo<SettingsContextValue>(
    () => ({
      themeMode: settings.themeMode,
      resolvedTheme,
      colors: resolvedTheme === "dark" ? darkColors : lightColors,
      terminalFontSize: settings.terminalFontSize,
      setThemeMode,
      setTerminalFontSize,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, resolvedTheme],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
