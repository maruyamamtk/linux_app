import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { helpSections } from "../../content/help";
import { useSettings } from "../../state/SettingsContext";
import type { ThemeColors } from "../../theme/colors";

/**
 * 使い方(ヘルプ)画面(docs/requirements.md 5章8節)。初めて使うユーザー向けに、
 * ターミナル演習の基本操作・ヒント/解答解説・進捗管理・演習種別ごとの違いを説明する。
 * 章一覧画面ヘッダーの「使い方」から遷移する。
 */
export function HelpScreen() {
  const { colors } = useSettings();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {helpSections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.body.map((line) => (
            <Text key={line} style={styles.bodyText}>
              {line}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, gap: 24 },
    section: { gap: 8 },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.textSecondary },
    bodyText: { fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  });
}
