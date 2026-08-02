// SimpleCommand単体の実行: 単語展開 → 変数代入の適用 → リダイレクト解決 → コマンド起動 → 出力の振り分け。
import { executeCommand, type CommandContext, type CommandResult } from "../commands";
import type { SimpleCommand } from "../shell";
import { expandWord } from "./expand";
import { ShellRuntimeError } from "./errors";
import { applyOutputRedirects, resolveRedirects } from "./redirect";
import type { ShellState } from "./types";

export interface SimpleCommandOutcome {
  result: CommandResult;
  /** fd1が端末/パイプのまま(ファイルへリダイレクトされていない)であった場合の標準出力。パイプラインの次段の標準入力として使う。 */
  stdoutFlow: string;
}

/** `NAME=value` を一時的に適用し、コールバック実行後に元の値へ戻す(コマンド末尾に一時変数として渡す用途)。 */
function withTemporaryEnv<T>(env: Record<string, string>, overrides: Map<string, string>, run: () => T): T {
  const saved = new Map<string, string | undefined>();
  for (const [name, value] of overrides) {
    saved.set(name, env[name]);
    env[name] = value;
  }
  try {
    return run();
  } finally {
    for (const [name, previous] of saved) {
      if (previous === undefined) delete env[name];
      else env[name] = previous;
    }
  }
}

export function runSimpleCommand(cmd: SimpleCommand, incomingStdin: string, state: ShellState): SimpleCommandOutcome {
  try {
    const words = cmd.words.map((word) => expandWord(word, state));
    const isBareAssignment = words.length === 0;

    const persistentAssignments = new Map<string, string>();
    const temporaryAssignments = new Map<string, string>();
    for (const assignment of cmd.assignments) {
      const value = expandWord(assignment.value, state);
      (isBareAssignment ? persistentAssignments : temporaryAssignments).set(assignment.name, value);
    }
    for (const [name, value] of persistentAssignments) {
      state.context.env[name] = value;
    }

    return withTemporaryEnv(state.context.env, temporaryAssignments, () =>
      runExpandedCommand(cmd, words, incomingStdin, state),
    );
  } catch (caught) {
    if (caught instanceof ShellRuntimeError) {
      return { result: { stdout: "", stderr: `bash: ${caught.message}\n`, exitCode: 1 }, stdoutFlow: "" };
    }
    throw caught;
  }
}

function runExpandedCommand(
  cmd: SimpleCommand,
  words: string[],
  incomingStdin: string,
  state: ShellState,
): SimpleCommandOutcome {
  const redirectResolution = resolveRedirects(cmd.redirects, state);
  if (redirectResolution.error) {
    return { result: { stdout: "", stderr: redirectResolution.error, exitCode: 1 }, stdoutFlow: "" };
  }

  if (words.length === 0) {
    // 代入のみ、またはコマンドを伴わないリダイレクトのみの文。
    // bashと同様、コマンドは起動しないがリダイレクトによるファイルの作成/切り詰めは行う。
    const { terminalStdout, terminalStderr } = applyOutputRedirects(
      state.context.vfs,
      redirectResolution.stdout,
      redirectResolution.stderr,
      "",
      "",
    );
    return { result: { stdout: terminalStdout, stderr: terminalStderr, exitCode: 0 }, stdoutFlow: terminalStdout };
  }

  const [name, ...args] = words;
  const stdin = redirectResolution.stdinOverride ?? incomingStdin;
  const commandContext: CommandContext = {
    ...state.context,
    stdin,
  };

  const raw = executeCommand(name, args, commandContext);
  // cd等の組み込みコマンドはcontext.cwdを直接書き換えるため、呼び出し元の状態へ反映する。
  state.context.cwd = commandContext.cwd;

  const { terminalStdout, terminalStderr } = applyOutputRedirects(
    state.context.vfs,
    redirectResolution.stdout,
    redirectResolution.stderr,
    raw.stdout,
    raw.stderr,
  );

  return {
    result: { stdout: terminalStdout, stderr: terminalStderr, exitCode: raw.exitCode },
    stdoutFlow: terminalStdout,
  };
}
