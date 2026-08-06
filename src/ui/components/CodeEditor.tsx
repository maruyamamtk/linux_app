import { Fragment } from "react";
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { HIGHLIGHT_COLORS, tokenizeShellLine } from "./shellSyntaxHighlight";

const MONOSPACE_FONT = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });
const FONT_SIZE = 13;
const LINE_HEIGHT = 20;

export interface CodeEditorProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

/**
 * シンタックスハイライト付きのシェルスクリプトエディタ(docs/requirements.md 3章8節・5章)。
 * 判定ロジックは持たず、入力中のテキストを保持・表示するのみ(実行・採点は呼び出し元が担う)。
 *
 * 実装方式: 透明色にした複数行`TextInput`の背後に、同じフォント/行高でハイライト済みテキストを
 * 重ねて表示する(RNには複数色のテキストを直接編集させる標準APIが無いための一般的な回避策)。
 * 両者は同一の`value`から描画され、行数が変わっても常に同期する。
 */
export function CodeEditor({ value, onChangeText, placeholder }: CodeEditorProps) {
  const lines = value.split("\n");

  return (
    <View style={styles.container}>
      <ScrollView>
        <View style={styles.row}>
          <View style={styles.gutter}>
            {lines.map((_line, index) => (
              <Text key={index} style={styles.gutterText}>
                {index + 1}
              </Text>
            ))}
          </View>
          <View style={styles.editorArea}>
            <Text style={styles.highlightLayer}>
              {lines.map((line, index) => (
                <Fragment key={index}>
                  {tokenizeShellLine(line).map((token, tokenIndex) => (
                    <Text key={tokenIndex} style={{ color: HIGHLIGHT_COLORS[token.type] }}>
                      {token.text}
                    </Text>
                  ))}
                  {index < lines.length - 1 ? "\n" : null}
                </Fragment>
              ))}
            </Text>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={onChangeText}
              multiline
              scrollEnabled={false}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              spellCheck={false}
              placeholder={placeholder}
              placeholderTextColor="#6b7280"
              textAlignVertical="top"
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0d1117",
    borderRadius: 8,
    overflow: "hidden",
    minHeight: 160,
    maxHeight: 280,
  },
  row: { flexDirection: "row" },
  gutter: {
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "#30363d",
  },
  gutterText: {
    fontFamily: MONOSPACE_FONT,
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    color: "#6e7681",
    textAlign: "right",
  },
  editorArea: { flex: 1 },
  highlightLayer: {
    padding: 8,
    fontFamily: MONOSPACE_FONT,
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
  },
  input: {
    ...StyleSheet.absoluteFillObject,
    padding: 8,
    fontFamily: MONOSPACE_FONT,
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    color: "transparent",
  },
});
