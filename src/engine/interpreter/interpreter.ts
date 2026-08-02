// Script(AST) → 実行。パイプライン(`|`)・論理演算子(`&&` `||`)・区切り(`;` 改行)を上から順に処理する。
import type { CommandContext, CommandResult } from "../commands";
import type { AndOrList, Pipeline, Script } from "../shell";
import { parseScript } from "../shell";
import { runSimpleCommand } from "./simpleCommand";
import type { ShellState } from "./types";

const EMPTY_RESULT: CommandResult = { stdout: "", stderr: "", exitCode: 0 };

/**
 * パイプラインを実行する。各コマンドのfd1が端末のまま(リダイレクトされていない)であれば、
 * その出力を次のコマンドの標準入力として渡す。最終段のfd1がそのまま呼び出し元への標準出力になる。
 * 終了ステータスは最終段の終了コード(bashのデフォルト、`pipefail`相当は未対応)。
 */
function runPipeline(pipeline: Pipeline, state: ShellState): CommandResult {
  let stdin = "";
  let last: CommandResult = EMPTY_RESULT;
  const stderrParts: string[] = [];

  for (const command of pipeline.commands) {
    const { result, stdoutFlow } = runSimpleCommand(command, stdin, state);
    if (result.stderr) stderrParts.push(result.stderr);
    last = result;
    stdin = stdoutFlow;
  }

  return { stdout: last.stdout, stderr: stderrParts.join(""), exitCode: last.exitCode };
}

/** `&&`/`||` で連結されたパイプライン列を短絡評価しながら実行する。 */
function runAndOrList(list: AndOrList, state: ShellState): CommandResult {
  let result = runPipeline(list.pipelines[0], state);
  const stdoutParts = [result.stdout];
  const stderrParts = [result.stderr];

  for (let i = 0; i < list.operators.length; i += 1) {
    const shouldRun = list.operators[i] === "&&" ? result.exitCode === 0 : result.exitCode !== 0;
    if (!shouldRun) continue;

    result = runPipeline(list.pipelines[i + 1], state);
    stdoutParts.push(result.stdout);
    stderrParts.push(result.stderr);
  }

  return { stdout: stdoutParts.join(""), stderr: stderrParts.join(""), exitCode: result.exitCode };
}

export function runScript(script: Script, state: ShellState): CommandResult {
  let result: CommandResult = EMPTY_RESULT;
  const stdoutParts: string[] = [];
  const stderrParts: string[] = [];

  for (const item of script.body) {
    result = runAndOrList(item.andOr, state);
    state.lastExitCode = result.exitCode;
    stdoutParts.push(result.stdout);
    stderrParts.push(result.stderr);
  }

  return { stdout: stdoutParts.join(""), stderr: stderrParts.join(""), exitCode: result.exitCode };
}

/** コマンド置換 `$(...)` 用のサブシェル状態を作る。`cwd`/`env` は複製し、`vfs` は共有する。 */
function createSubshellState(parent: ShellState): ShellState {
  const subshellContext: CommandContext = {
    ...parent.context,
    env: { ...parent.context.env },
  };
  const subshellState: ShellState = {
    context: subshellContext,
    lastExitCode: parent.lastExitCode,
    runSubshell: (script) => runScript(script, createSubshellState(subshellState)),
  };
  return subshellState;
}

/** シェル入力文字列をパースして実行する、インタプリタの公開エントリポイント。 */
export function executeShellInput(input: string, context: CommandContext): CommandResult {
  const script = parseScript(input);
  const state: ShellState = {
    context,
    lastExitCode: 0,
    runSubshell: (subScript) => runScript(subScript, createSubshellState(state)),
  };
  return runScript(script, state);
}
