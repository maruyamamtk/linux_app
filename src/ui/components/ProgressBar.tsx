import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { useSettings } from "../../state/SettingsContext";
import type { ThemeColors } from "../../theme/colors";

export interface ProgressBarProps {
  /** 0〜1の完了率。範囲外の値は自動的にクランプされる。 */
  progress: number;
}

export function ProgressBar({ progress }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, progress));
  const { colors } = useSettings();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${clamped * 100}%` }]} />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.chip,
      overflow: "hidden",
    },
    fill: {
      height: "100%",
      backgroundColor: colors.primary,
      borderRadius: 3,
    },
  });
}
