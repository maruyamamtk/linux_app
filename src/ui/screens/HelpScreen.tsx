import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useSettings } from "../../state/SettingsContext";
import type { ThemeColors } from "../../theme/colors";

type HelpSection = {
  title: string;
  body: string[];
};

const SECTIONS: HelpSection[] = [
  {
    title: "ターミナル演習の基本操作",
    body: [
      "画面下部の入力欄にLinuxコマンドを入力し、Enterで実行します。",
      "実行結果は仮想ターミナル上に表示されます(実機・実サーバーには一切影響しません)。",
      "コマンドを入力できたら「答え合わせ」ボタンで採点します。「正解です!」と表示されれば演習クリアです。",
    ],
  },
  {
    title: "ヒント・解答解説の見方",
    body: [
      "「ヒントを見る」ボタンで、段階的なヒントを表示できます(使用できる回数には上限があります)。",
      "自力で解けない場合は「解答・解説を見る」から模範解答とその解説を確認できます。",
    ],
  },
  {
    title: "進捗管理(マイページ)",
    body: [
      "章一覧画面右上の「マイページ」から、章ごとのクリア状況を確認できます。",
      "答え合わせで不正解のまま残っている演習は「要復習リスト」に表示され、タップするとその演習に戻れます。",
    ],
  },
  {
    title: "演習の種類ごとの違い",
    body: [
      "ターミナル演習: コマンドを1つずつ入力して実行する、最も基本的な演習形式です。",
      "スクリプト作成: コードエディタでシェルスクリプトを書き、テストケースの実行結果を確認します。",
      "クイズ: 選択式の問題に回答します。",
      "Vim演習: モード(ノーマル/インサート等)を意識しながらキー操作でバッファを編集します。",
      "Git演習: コミットグラフを見ながらGitコマンドを入力し、バージョン管理の操作を学びます。",
    ],
  },
];

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
      {SECTIONS.map((section) => (
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
    sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
    bodyText: { fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  });
}
