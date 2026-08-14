import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  MAX_TERMINAL_FONT_SIZE,
  MIN_TERMINAL_FONT_SIZE,
} from "../../state/settings";
import type { ThemeMode } from "../../state/settings";
import { useSettings } from "../../state/SettingsContext";
import type { ThemeColors } from "../../theme/colors";

const THEME_MODE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "ライト" },
  { value: "dark", label: "ダーク" },
  { value: "system", label: "端末に合わせる" },
];

const FONT_SIZE_STEP = 1;

/**
 * 表示設定画面(docs/requirements.md 7章「ダークモード対応、ターミナル部分はフォントサイズ調整可」)。
 * マイページから遷移し、テーマモードとターミナルのフォントサイズを切り替えられる。
 * 設定値の永続化は`SettingsContext`(`AsyncStorage`)に委譲する。
 */
export function SettingsScreen() {
  const { themeMode, terminalFontSize, colors, setThemeMode, setTerminalFontSize } = useSettings();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>テーマ</Text>
        <View style={styles.optionRow}>
          {THEME_MODE_OPTIONS.map((option) => {
            const selected = option.value === themeMode;
            return (
              <Pressable
                key={option.value}
                style={[styles.optionButton, selected && styles.optionButtonSelected]}
                onPress={() => setThemeMode(option.value)}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ターミナルのフォントサイズ</Text>
        <View style={styles.fontSizeRow}>
          <Pressable
            style={styles.stepButton}
            onPress={() => setTerminalFontSize(terminalFontSize - FONT_SIZE_STEP)}
            disabled={terminalFontSize <= MIN_TERMINAL_FONT_SIZE}
          >
            <Text style={styles.stepButtonText}>−</Text>
          </Pressable>
          <Text style={styles.fontSizeValue}>{terminalFontSize}pt</Text>
          <Pressable
            style={styles.stepButton}
            onPress={() => setTerminalFontSize(terminalFontSize + FONT_SIZE_STEP)}
            disabled={terminalFontSize >= MAX_TERMINAL_FONT_SIZE}
          >
            <Text style={styles.stepButtonText}>＋</Text>
          </Pressable>
        </View>
        <View style={styles.preview}>
          <Text style={[styles.previewText, { fontSize: terminalFontSize }]}>
            $ echo &quot;hello, linux&quot;
          </Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 24 },
    section: { gap: 10 },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.textSecondary },
    optionRow: { flexDirection: "row", gap: 8 },
    optionButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: "center",
      backgroundColor: colors.chip,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    optionButtonSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    optionText: { fontSize: 13, fontWeight: "600", color: colors.text },
    optionTextSelected: { color: colors.primaryContrast },
    fontSizeRow: { flexDirection: "row", alignItems: "center", gap: 16 },
    stepButton: {
      width: 44,
      height: 44,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.chip,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    stepButtonText: { fontSize: 20, fontWeight: "700", color: colors.text },
    fontSizeValue: { fontSize: 16, fontWeight: "600", color: colors.text, minWidth: 48, textAlign: "center" },
    preview: {
      marginTop: 4,
      padding: 12,
      borderRadius: 8,
      backgroundColor: "#0d1117",
    },
    previewText: { color: "#e6edf3", fontFamily: "monospace" },
  });
}
