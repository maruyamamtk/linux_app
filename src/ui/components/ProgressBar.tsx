import { StyleSheet, View } from "react-native";

export interface ProgressBarProps {
  /** 0〜1の完了率。範囲外の値は自動的にクランプされる。 */
  progress: number;
}

export function ProgressBar({ progress }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${clamped * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#e1e4e8",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: "#1a7f37",
    borderRadius: 3,
  },
});
