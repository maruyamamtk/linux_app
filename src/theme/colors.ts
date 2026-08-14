/**
 * アプリ全体(ターミナル/Vim/コードエディタ等の常時暗色な演習領域を除く)で使う
 * ライト/ダークテーマの色トークン(docs/requirements.md 7章「ダークモード対応」)。
 */
export type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryContrast: string;
  danger: string;
  dangerBg: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  info: string;
  infoBg: string;
  chip: string;
  placeholder: string;
};

export const lightColors: ThemeColors = {
  background: "#ffffff",
  surface: "#f6f8fa",
  surfaceAlt: "#eaeef2",
  border: "#d0d7de",
  text: "#24292f",
  textSecondary: "#57606a",
  textMuted: "#888888",
  primary: "#1a7f37",
  primaryContrast: "#ffffff",
  danger: "#cf222e",
  dangerBg: "#ffebe9",
  success: "#1a7f37",
  successBg: "#dafbe1",
  warning: "#bc4c00",
  warningBg: "#fff1e5",
  info: "#0969da",
  infoBg: "#ddf4ff",
  chip: "#eeeeee",
  placeholder: "#6b7280",
};

export const darkColors: ThemeColors = {
  background: "#0d1117",
  surface: "#161b22",
  surfaceAlt: "#21262d",
  border: "#30363d",
  text: "#e6edf3",
  textSecondary: "#8b949e",
  textMuted: "#6e7681",
  primary: "#3fb950",
  primaryContrast: "#0d1117",
  danger: "#f85149",
  dangerBg: "#3d1214",
  success: "#3fb950",
  successBg: "#0f2e1a",
  warning: "#e3b341",
  warningBg: "#3a2a05",
  info: "#58a6ff",
  infoBg: "#0c2d6b",
  chip: "#21262d",
  placeholder: "#6b7280",
};
