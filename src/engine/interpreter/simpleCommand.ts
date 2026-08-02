// SimpleCommand単体の実行: 単語展開 → 変数代入の適用 → リダイレクト解決 → コマンド起動 → 出力の振り分け。
// コマンド名がシェル関数として定義されていればその本体を実行し、`local`/`return` はここで
// 直接扱う(どちらも`state`(local変数フレーム・呼び出し段数)へのアクセスが必要で、
// commands/配下の通常の組み込みコマンド(CommandContextのみを受け取る)としては実装できないため)。
import { executeCommand, type CommandContext, type CommandResult } from "../commands";
import type { FunctionDefinition, SimpleCommand } from "../shell";
import { expandWord, expandWordToFields } from "./expand";
import { ShellRuntimeError } from "./errors";
import { applyOutputRedirects, resolveRedirects, type RedirectResolution } from "./redirect";
import type { LocalFrame, ShellState } from "./types";

export interface SimpleCommandOutcome {
  result: CommandResult;
  /** fd1が端末/パイプのまま(ファイルへリダイレクトされていない)であった場合の標準出力。パイプラインの次段の標準入力として使う。 */
  stdoutFlow: string;
}

/**
 * シェル関数の再帰呼び出しの上限段数(暴走した再帰でスタックを溢れさせないための安全弁)。
 * モバイル(Hermes)のコールスタック上限は環境により小さいため、比較的保守的な値にしている。
 */
const MAX_CALL_DEPTH = 100;

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
    const words = cmd.words.flatMap((word) => expandWordToFields(word, state));
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
    return finalizeOutcome({ stdout: "", stderr: "", exitCode: 0 }, redirectResolution, state);
  }

  const [name, ...args] = words;
  const stdin = redirectResolution.stdinOverride ?? incomingStdin;

  if (name === "return") {
    return finalizeOutcome(runReturnBuiltin(args, state), redirectResolution, state);
  }
  if (name === "local") {
    return finalizeOutcome(runLocalBuiltin(args, state), redirectResolution, state);
  }
  if (name === "exit") {
    return finalizeOutcome(runExitBuiltin(args, state), redirectResolution, state);
  }
  const fn = state.functions[name];
  if (fn) {
    return finalizeOutcome(callFunction(fn, args, state), redirectResolution, state);
  }

  const commandContext: CommandContext = {
    ...state.context,
    stdin,
  };

  const raw = executeCommand(name, args, commandContext);
  // cd等の組み込みコマンドはcontext.cwdを直接書き換えるため、呼び出し元の状態へ反映する。
  state.context.cwd = commandContext.cwd;

  return finalizeOutcome(raw, redirectResolution, state);
}

function finalizeOutcome(
  raw: CommandResult,
  redirectResolution: RedirectResolution,
  state: ShellState,
): SimpleCommandOutcome {
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

/**
 * `return [n]`。関数本体内でのみ有効。`state.returning` を立てて、関数呼び出し元
 * (`callFunction`)まで各実行ループ(runCompoundList/runAndOrList/runPipeline)を
 * 早期終了させながら巻き戻す。関数外で呼ばれた場合はbashと同様エラーにする。
 */
function runReturnBuiltin(args: string[], state: ShellState): CommandResult {
  if (state.callDepth === 0) {
    return { stdout: "", stderr: "bash: return: 関数の外では使用できません\n", exitCode: 1 };
  }
  const exitCode = parseExitCode(args[0], state.lastExitCode);
  state.returning = { exitCode };
  return { stdout: "", stderr: "", exitCode };
}

function parseExitCode(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return ((Math.trunc(value) % 256) + 256) % 256;
}

/**
 * `exit [n]`。`state.exiting` を立てて、関数呼び出しの境界を越えてスクリプト全体の実行を
 * 打ち切るまで各実行ループを早期終了させながら巻き戻す(`return`と異なり`callFunction`では
 * 消費されないため、関数の中から呼んでもそのまま呼び出し元・トップレベルまで伝播する)。
 */
function runExitBuiltin(args: string[], state: ShellState): CommandResult {
  const exitCode = parseExitCode(args[0], state.lastExitCode);
  state.exiting = { exitCode };
  return { stdout: "", stderr: "", exitCode };
}

/**
 * `local NAME[=value] ...`。関数本体内でのみ有効。現在の呼び出しフレームに元の値を
 * 退避した上で、`NAME` を現在の環境に(値付き、または未設定として)束縛する。
 * 同じフレーム内で複数回 `local` された変数は最初の退避値のみを保持する(2回目以降は
 * 既にこの呼び出し内でlocal化済みのため、関数呼び出し前の値を上書きしない)。
 */
function runLocalBuiltin(args: string[], state: ShellState): CommandResult {
  const frame = state.localFrames[state.localFrames.length - 1];
  if (state.callDepth === 0 || !frame) {
    return { stdout: "", stderr: "bash: local: 関数の外では使用できません\n", exitCode: 1 };
  }

  for (const arg of args) {
    const eq = arg.indexOf("=");
    const name = eq === -1 ? arg : arg.slice(0, eq);
    if (!frame.has(name)) {
      frame.set(name, state.context.env[name]);
    }
    if (eq === -1) {
      delete state.context.env[name];
    } else {
      state.context.env[name] = arg.slice(eq + 1);
    }
  }

  return { stdout: "", stderr: "", exitCode: 0 };
}

function restoreLocalFrame(frame: LocalFrame, env: Record<string, string>): void {
  for (const [name, previousValue] of frame) {
    if (previousValue === undefined) delete env[name];
    else env[name] = previousValue;
  }
}

/**
 * シェル関数を呼び出す: 位置パラメータ(`$1..`)を引数に差し替え、新しい`local`フレームを積んだ上で
 * 関数本体を実行する。`return` による早期終了(`state.returning`)を検知したらここで消費し
 * (呼び出し元の実行ループへ伝播させない)、そのステータスを呼び出し結果の終了コードとする。
 * `exit` による早期終了(`state.exiting`)はここでは消費せず、`result`をそのまま返すことで
 * 呼び出し元の実行ループへ伝播させ続ける(スクリプト全体を終了させるため)。
 */
function callFunction(fn: FunctionDefinition, args: string[], state: ShellState): CommandResult {
  state.callDepth += 1;
  if (state.callDepth > MAX_CALL_DEPTH) {
    state.callDepth -= 1;
    throw new ShellRuntimeError(`${fn.name}: 関数呼び出しの再帰が深すぎます(上限${MAX_CALL_DEPTH}段)`);
  }

  const savedPositionalParams = state.positionalParams;
  state.positionalParams = args;
  const frame: LocalFrame = new Map();
  state.localFrames.push(frame);

  try {
    const result = state.runCompoundList(fn.body);
    if (state.returning) {
      const exitCode = state.returning.exitCode;
      state.returning = undefined;
      state.lastExitCode = exitCode;
      return { stdout: result.stdout, stderr: result.stderr, exitCode };
    }
    return result;
  } finally {
    state.positionalParams = savedPositionalParams;
    state.localFrames.pop();
    restoreLocalFrame(frame, state.context.env);
    state.callDepth -= 1;
  }
}
