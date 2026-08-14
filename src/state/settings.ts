/**
 * 表示設定(docs/requirements.md 7章「ダークモード対応、ターミナル部分はフォントサイズ調整可」)を
 * 表す型と、AsyncStorageへの保存文字列との相互変換を行う純粋関数群。
 * React/AsyncStorageに依存しないため単体テストしやすく、`state/SettingsContext.tsx` から利用する。
 */

export type ThemeMode = "light" | "dark" | "system";

export type DisplaySettings = {
  themeMode: ThemeMode;
  terminalFontSize: number;
};

export const MIN_TERMINAL_FONT_SIZE = 11;
export const MAX_TERMINAL_FONT_SIZE = 19;
export const DEFAULT_TERMINAL_FONT_SIZE = 13;

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  themeMode: "system",
  terminalFontSize: DEFAULT_TERMINAL_FONT_SIZE,
};

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

/** ターミナルのフォントサイズを許容範囲内に丸める。 */
export function clampTerminalFontSize(size: number): number {
  if (!Number.isFinite(size)) return DEFAULT_TERMINAL_FONT_SIZE;
  return Math.min(MAX_TERMINAL_FONT_SIZE, Math.max(MIN_TERMINAL_FONT_SIZE, Math.round(size)));
}

/** AsyncStorageから読み込んだ生の文字列を検証しつつパースする。壊れたデータは無視して初期設定を返す。 */
export function parseStoredDisplaySettings(raw: string | null): DisplaySettings {
  if (!raw) return DEFAULT_DISPLAY_SETTINGS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_DISPLAY_SETTINGS;
    const record = parsed as Record<string, unknown>;
    const themeMode = isThemeMode(record.themeMode)
      ? record.themeMode
      : DEFAULT_DISPLAY_SETTINGS.themeMode;
    const terminalFontSize =
      typeof record.terminalFontSize === "number"
        ? clampTerminalFontSize(record.terminalFontSize)
        : DEFAULT_DISPLAY_SETTINGS.terminalFontSize;
    return { themeMode, terminalFontSize };
  } catch {
    return DEFAULT_DISPLAY_SETTINGS;
  }
}

export function serializeDisplaySettings(settings: DisplaySettings): string {
  return JSON.stringify(settings);
}
