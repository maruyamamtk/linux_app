import { forwardRef, useEffect, useImperativeHandle, useReducer, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { applyKey, bufferToFileText, createInitialState } from "../../engine/vim";
import type { PendingCommand, VimKey, VimMode } from "../../engine/vim";

const MONOSPACE_FONT = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export interface VimEditorHandle {
  /** 現在のバッファ内容をファイル形式(末尾改行あり)で返す(答え合わせ用)。 */
  getBufferText: () => string;
}

export interface VimEditorProps {
  /** Vimエディタ起動時に読み込む初期バッファ内容(ファイル形式、末尾改行あり)。 */
  initialFileText: string;
}

const MODE_LABELS: Record<VimMode, string> = {
  normal: "ノーマル",
  insert: "インサート",
  cmdline: "コマンドライン",
};

const KEY_LABELS: Record<string, string> = {
  "Ctrl-r": "^R",
  Escape: "Esc",
  Backspace: "⌫",
  Enter: "⏎",
};

const MODE_ENTRY_KEYS = ["i", "a", "I", "A", "o", "O", ":"];
const MOTION_KEYS = ["h", "j", "k", "l", "0", "$", "w", "b", "e", "gg", "G"];
const OPERATOR_KEYS = ["d", "y", "c", "x", "D", "Y"];
const EDIT_KEYS = ["p", "P", "u", "Ctrl-r"];
const DIGIT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

function keyLabel(key: string): string {
  return KEY_LABELS[key] ?? key;
}

function pendingLabel(pending: PendingCommand): string | null {
  const label = `${pending.count}${pending.operator ?? ""}${pending.motionCount}${pending.awaitingG ? "g" : ""}`;
  return label.length > 0 ? label : null;
}

/**
 * ソフトウェアキーボードからの`onChangeText`イベント(常に空文字列にリセットする「捨て」入力欄)を、
 * `VimKey`の列に変換する。共通の先頭部分より後ろを「削除された分のBackspace」+「挿入された文字」として扱う。
 */
function keysFromTextDiff(prev: string, next: string): VimKey[] {
  let prefixLength = 0;
  const maxPrefix = Math.min(prev.length, next.length);
  while (prefixLength < maxPrefix && prev[prefixLength] === next[prefixLength]) prefixLength += 1;

  const removedCount = prev.length - prefixLength;
  const insertedText = next.slice(prefixLength);
  const keys: VimKey[] = [];
  for (let i = 0; i < removedCount; i += 1) keys.push("Backspace");
  for (const ch of insertedText) keys.push(ch === "\n" ? "Enter" : ch);
  return keys;
}

function renderLineContent(line: string, isCursorLine: boolean, cursorCol: number, mode: VimMode): ReactNode {
  if (!isCursorLine) return line;

  if (mode === "insert") {
    return (
      <>
        {line.slice(0, cursorCol)}
        <Text style={styles.caret}>{"│"}</Text>
        {line.slice(cursorCol)}
      </>
    );
  }

  const charAtCursor = line[cursorCol] ?? " ";
  return (
    <>
      {line.slice(0, cursorCol)}
      <Text style={styles.cursorBlock}>{charAtCursor}</Text>
      {line.slice(cursorCol + 1)}
    </>
  );
}

/**
 * Vimシミュレータ(`src/engine/vim`)を使った演習画面用のエディタUI(docs/requirements.md 3章5節)。
 * モード表示・キー入力ログ・現在のバッファ内容の表示に加え、物理キーボードの`hjkl`等を前提にできない
 * モバイル環境向けに、画面下部へVim操作用の専用キーパッドを配置する
 * (docs/vim-simulator-design.md 7章)。判定ロジックは持たず、呼び出し元が`getBufferText`で
 * 最終的なバッファ内容を取得して答え合わせを行う想定。
 */
export const VimEditor = forwardRef<VimEditorHandle, VimEditorProps>(function VimEditor(
  { initialFileText },
  ref,
) {
  const [state, dispatch] = useReducer(applyKey, initialFileText, createInitialState);
  const [insertDraft, setInsertDraft] = useState("");
  const [cmdDraft, setCmdDraft] = useState("");
  const insertInputRef = useRef<TextInput>(null);
  const cmdInputRef = useRef<TextInput>(null);

  useImperativeHandle(ref, () => ({ getBufferText: () => bufferToFileText(state.buffer) }), [state.buffer]);

  useEffect(() => {
    if (state.mode === "insert") {
      setInsertDraft("");
      requestAnimationFrame(() => insertInputRef.current?.focus());
    } else if (state.mode === "cmdline") {
      setCmdDraft("");
      requestAnimationFrame(() => cmdInputRef.current?.focus());
    }
  }, [state.mode]);

  function handleInsertChangeText(text: string) {
    keysFromTextDiff(insertDraft, text).forEach((key) => dispatch(key));
    setInsertDraft("");
  }

  function handleCmdChangeText(text: string) {
    keysFromTextDiff(cmdDraft, text).forEach((key) => dispatch(key));
    setCmdDraft("");
  }

  function renderKeyButton(key: VimKey) {
    return (
      <Pressable key={key} style={styles.key} onPress={() => dispatch(key)}>
        <Text style={styles.keyText}>{keyLabel(key)}</Text>
      </Pressable>
    );
  }

  const pending = pendingLabel(state.pending);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.statusBar}>
        <Text style={styles.modeBadge}>{MODE_LABELS[state.mode]}</Text>
        {pending && <Text style={styles.pendingText}>入力中: {pending}</Text>}
        {state.statusMessage && (
          <Text style={state.statusMessage.isError ? styles.statusError : styles.statusOk}>
            {state.statusMessage.text}
          </Text>
        )}
      </View>

      <ScrollView style={styles.bufferArea} contentContainerStyle={styles.bufferContent}>
        {state.buffer.lines.map((line, index) => (
          <View key={index} style={styles.lineRow}>
            <Text style={styles.gutterText}>{index + 1}</Text>
            <Text style={styles.lineText}>
              {renderLineContent(line, index === state.cursor.line, state.cursor.col, state.mode)}
            </Text>
          </View>
        ))}
        {state.mode === "cmdline" && (
          <View style={styles.lineRow}>
            <Text style={styles.gutterText}>:</Text>
            <Text style={styles.lineText}>
              {state.commandLine}
              <Text style={styles.caret}>{"│"}</Text>
            </Text>
          </View>
        )}
      </ScrollView>

      <ScrollView
        horizontal
        style={styles.keyLogRow}
        contentContainerStyle={styles.keyLogContent}
        showsHorizontalScrollIndicator={false}
      >
        {state.keyLog.slice(-40).map((key, index) => (
          <Text key={`${index}-${key}`} style={styles.keyLogChip}>
            {keyLabel(key)}
          </Text>
        ))}
      </ScrollView>

      {state.mode === "insert" && (
        <View style={styles.textCaptureRow}>
          <TextInput
            ref={insertInputRef}
            style={styles.textCaptureInput}
            value={insertDraft}
            onChangeText={handleInsertChangeText}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            placeholder="ここに入力してください"
            placeholderTextColor="#6b7280"
          />
        </View>
      )}

      {state.mode === "cmdline" && (
        <View style={styles.textCaptureRow}>
          <Text style={styles.promptText}>:</Text>
          <TextInput
            ref={cmdInputRef}
            style={styles.textCaptureInput}
            value={cmdDraft}
            onChangeText={handleCmdChangeText}
            onSubmitEditing={() => dispatch("Enter")}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            returnKeyType="send"
            placeholder="exコマンド"
            placeholderTextColor="#6b7280"
          />
        </View>
      )}

      <View style={styles.keypad}>
        <View style={styles.keyRow}>
          {renderKeyButton("Escape")}
          {(state.mode === "insert" || state.mode === "cmdline") && renderKeyButton("Backspace")}
          {(state.mode === "insert" || state.mode === "cmdline") && renderKeyButton("Enter")}
        </View>
        {state.mode === "normal" && (
          <>
            <View style={styles.keyRow}>{MODE_ENTRY_KEYS.map(renderKeyButton)}</View>
            <View style={styles.keyRow}>{MOTION_KEYS.map(renderKeyButton)}</View>
            <View style={styles.keyRow}>{OPERATOR_KEYS.map(renderKeyButton)}</View>
            <View style={styles.keyRow}>{EDIT_KEYS.map(renderKeyButton)}</View>
            <View style={styles.keyRow}>{DIGIT_KEYS.map(renderKeyButton)}</View>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d1117", borderRadius: 8, overflow: "hidden" },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#30363d",
  },
  modeBadge: {
    fontFamily: MONOSPACE_FONT,
    fontSize: 12,
    fontWeight: "700",
    color: "#0d1117",
    backgroundColor: "#58a6ff",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  pendingText: { fontFamily: MONOSPACE_FONT, fontSize: 12, color: "#e3b341" },
  statusOk: { fontFamily: MONOSPACE_FONT, fontSize: 12, color: "#3fb950" },
  statusError: { fontFamily: MONOSPACE_FONT, fontSize: 12, color: "#f85149" },
  bufferArea: { flex: 1 },
  bufferContent: { padding: 8 },
  lineRow: { flexDirection: "row" },
  gutterText: {
    width: 28,
    fontFamily: MONOSPACE_FONT,
    fontSize: 13,
    color: "#6e7681",
    textAlign: "right",
    marginRight: 8,
  },
  lineText: { flex: 1, fontFamily: MONOSPACE_FONT, color: "#e6edf3", fontSize: 13 },
  cursorBlock: { backgroundColor: "#e6edf3", color: "#0d1117" },
  caret: { color: "#58a6ff", fontWeight: "700" },
  keyLogRow: {
    maxHeight: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#30363d",
  },
  keyLogContent: { paddingHorizontal: 8, paddingVertical: 4, gap: 4, flexDirection: "row" },
  keyLogChip: {
    fontFamily: MONOSPACE_FONT,
    fontSize: 11,
    color: "#8b949e",
    backgroundColor: "#161b22",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  textCaptureRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#30363d",
  },
  promptText: { fontFamily: MONOSPACE_FONT, color: "#3fb950", fontWeight: "600", fontSize: 13 },
  textCaptureInput: {
    flex: 1,
    marginLeft: 6,
    maxHeight: 60,
    color: "#e6edf3",
    fontFamily: MONOSPACE_FONT,
    fontSize: 13,
  },
  keypad: {
    gap: 6,
    padding: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#30363d",
  },
  keyRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  key: {
    minWidth: 34,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#21262d",
  },
  keyText: { fontFamily: MONOSPACE_FONT, fontSize: 13, fontWeight: "600", color: "#e6edf3" },
});
