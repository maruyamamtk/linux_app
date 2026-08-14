import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { CommandContext, MockProcess } from "../../engine/commands";
import { executeShellInput } from "../../engine/interpreter";
import { VirtualFileSystem } from "../../engine/vfs";
import type { VfsSnapshot, VfsUser } from "../../engine/vfs";

const MONOSPACE_FONT = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export interface TerminalHistoryEntry {
  id: number;
  promptLabel: string;
  input: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface TerminalHandle {
  /**
   * 直近に実行したコマンド(入力文字列)を返す(答え合わせ用)。
   * 「答え合わせ」は最後に実行した1コマンド(または `;` `&&` でつないだ1行)を模範解答と
   * 突き合わせる想定で、それ以前に試しに打った `ls` 等の探索的なコマンドは対象にしない。
   */
  getLastCommand: () => string;
}

export interface TerminalProps {
  /** ターミナル起動時に読み込む仮想ファイルシステムのスナップショット。 */
  snapshot: VfsSnapshot;
  user: VfsUser;
  initialCwd: string;
  initialEnv?: Record<string, string>;
  processes?: MockProcess[];
  /** プロンプトの `@` の後に表示するホスト名(デフォルト: "linuxtraining")。 */
  hostName?: string;
  /**
   * コマンド実行のたびに(初回マウント時にも1回)呼ばれる、最新の`CommandContext`を渡すコールバック。
   * Git演習画面(`GitExerciseScreen`)がコミットグラフを再構築するために使う
   * (docs/git-simulator-design.md 10章: 「表示のたびにVFSから再構築する単純な方式」)。
   */
  onCommandExecuted?: (context: CommandContext) => void;
}

/**
 * `[study@linuxtraining practice]$` のようなプロンプト文字列を組み立てる(docs/requirements.md 5章参照)。
 * `ssh`で仮想リモートホストに接続中は`context.ssh.remoteHost`が設定されるため、`@`の後のホスト名を
 * それに差し替えることで、付録の「ssh切替体験」でプロンプト表示が変化する様子を再現する。
 */
function formatPrompt(context: CommandContext, user: VfsUser, hostName: string): string {
  const home = context.env.HOME ?? `/home/${user.name}`;
  const displayPath =
    context.cwd === home
      ? "~"
      : context.cwd.startsWith(`${home}/`)
        ? `~${context.cwd.slice(home.length)}`
        : context.cwd;
  const shortDir = displayPath === "~" ? "~" : (displayPath.split("/").pop() ?? "") || "/";
  return `[${user.name}@${context.ssh.remoteHost ?? hostName} ${shortDir}]$`;
}

/**
 * 演習の中心となる仮想ターミナル。プロンプト表示、コマンド入力、実行結果とスクロールバックの
 * 表示を担う。判定ロジックは持たず、エンジン層(`engine/interpreter`)にコマンドの実行を委譲する。
 */
export const Terminal = forwardRef<TerminalHandle, TerminalProps>(function Terminal(
  { snapshot, user, initialCwd, initialEnv, processes, hostName = "linuxtraining", onCommandExecuted },
  ref,
) {
  const contextRef = useRef<CommandContext | null>(null);
  if (!contextRef.current) {
    contextRef.current = {
      vfs: new VirtualFileSystem(snapshot, user),
      cwd: initialCwd,
      env: { HOME: initialCwd, PATH: "/bin:/usr/bin", ...initialEnv },
      processes: (processes ?? []).map((process) => ({ ...process })),
      ssh: {},
    };
  }
  const context = contextRef.current;

  const [history, setHistory] = useState<TerminalHistoryEntry[]>([]);
  const [prompt, setPrompt] = useState(() => formatPrompt(context, user, hostName));
  const [input, setInput] = useState("");
  const nextIdRef = useRef(0);
  const listRef = useRef<FlatList<TerminalHistoryEntry>>(null);

  useImperativeHandle(ref, () => ({
    getLastCommand: () => history[history.length - 1]?.input ?? "",
  }));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => onCommandExecuted?.(context), []);

  function runCommand() {
    const commandText = input.trim();
    if (commandText.length === 0) {
      setInput("");
      return;
    }

    const promptLabel = prompt;
    const result = executeShellInput(commandText, context);
    const entry: TerminalHistoryEntry = {
      id: nextIdRef.current++,
      promptLabel,
      input: commandText,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };

    setHistory((previous) => [...previous, entry]);
    setInput("");
    setPrompt(formatPrompt(context, user, hostName));
    onCommandExecuted?.(context);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FlatList
        ref={listRef}
        style={styles.scrollback}
        data={history}
        keyExtractor={(entry) => String(entry.id)}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View style={styles.entry}>
            <Text style={styles.line}>
              <Text style={styles.promptText}>{item.promptLabel} </Text>
              {item.input}
            </Text>
            {item.stdout.length > 0 && (
              <Text style={styles.stdout}>{item.stdout.replace(/\n$/, "")}</Text>
            )}
            {item.stderr.length > 0 && (
              <Text style={styles.stderr}>{item.stderr.replace(/\n$/, "")}</Text>
            )}
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <Text style={styles.promptText}>{prompt}</Text>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={runCommand}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          returnKeyType="send"
          placeholder="コマンドを入力"
          placeholderTextColor="#6b7280"
        />
      </View>
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d1117", borderRadius: 8, overflow: "hidden" },
  scrollback: { flex: 1, padding: 8 },
  entry: { marginBottom: 6 },
  line: { fontFamily: MONOSPACE_FONT, color: "#e6edf3", fontSize: 13 },
  promptText: { fontFamily: MONOSPACE_FONT, color: "#3fb950", fontWeight: "600", fontSize: 13 },
  stdout: { fontFamily: MONOSPACE_FONT, color: "#e6edf3", fontSize: 13 },
  stderr: { fontFamily: MONOSPACE_FONT, color: "#f85149", fontSize: 13 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#30363d",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    marginLeft: 6,
    color: "#e6edf3",
    fontFamily: MONOSPACE_FONT,
    fontSize: 13,
  },
});
