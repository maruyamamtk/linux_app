// Script(AST) → 実行。パイプライン(`|`)・論理演算子(`&&` `||`)・区切り(`;` 改行)・
// 制御構造(if/for/while/case)・関数定義を上から順に処理する。
import type { CommandContext, CommandResult } from "../commands";
import type {
  AndOrList,
  CaseClause,
  Command,
  ForClause,
  IfClause,
  Pipeline,
  Script,
  ScriptItem,
  WhileClause,
} from "../shell";
import { parseScript } from "../shell";
import { matchesCasePattern } from "./caseMatch";
import { expandWord } from "./expand";
import { ShellRuntimeError } from "./errors";
import { runSimpleCommand } from "./simpleCommand";
import type { ShellState } from "./types";

const EMPTY_RESULT: CommandResult = { stdout: "", stderr: "", exitCode: 0 };

/** `for`/`while` の暴走(無限ループ)を防ぐための反復回数の上限。 */
const MAX_LOOP_ITERATIONS = 100_000;

/**
 * パイプラインを実行する。各コマンドのfd1が端末のまま(リダイレクトされていない)であれば、
 * その出力を次のコマンドの標準入力として渡す。最終段のfd1がそのまま呼び出し元への標準出力になる。
 * 終了ステータスは最終段の終了コード(bashのデフォルト、`pipefail`相当は未対応)。
 * 途中の段で `return` が実行された場合(関数本体内)は、以降の段の実行を中断する。
 */
function runPipeline(pipeline: Pipeline, state: ShellState): CommandResult {
  let stdin = "";
  let last: CommandResult = EMPTY_RESULT;
  const stderrParts: string[] = [];

  for (const command of pipeline.commands) {
    const { result, stdoutFlow } = runCommand(command, stdin, state);
    if (result.stderr) stderrParts.push(result.stderr);
    last = result;
    stdin = stdoutFlow;
    if (state.returning) break;
  }

  return { stdout: last.stdout, stderr: stderrParts.join(""), exitCode: last.exitCode };
}

/** パイプラインの1段(単純コマンド・制御構造・関数定義)を実行する。 */
function runCommand(
  command: Command,
  incomingStdin: string,
  state: ShellState,
): { result: CommandResult; stdoutFlow: string } {
  switch (command.type) {
    case "SimpleCommand":
      return runSimpleCommand(command, incomingStdin, state);
    case "IfClause": {
      const result = runIfClause(command, state);
      return { result, stdoutFlow: result.stdout };
    }
    case "ForClause": {
      const result = runForClause(command, state);
      return { result, stdoutFlow: result.stdout };
    }
    case "WhileClause": {
      const result = runWhileClause(command, state);
      return { result, stdoutFlow: result.stdout };
    }
    case "CaseClause": {
      const result = runCaseClause(command, state);
      return { result, stdoutFlow: result.stdout };
    }
    case "FunctionDefinition":
      state.functions[command.name] = command;
      state.lastExitCode = 0;
      return { result: EMPTY_RESULT, stdoutFlow: "" };
  }
}

/** `&&`/`||` で連結されたパイプライン列を短絡評価しながら実行する。 */
function runAndOrList(list: AndOrList, state: ShellState): CommandResult {
  let result = runPipeline(list.pipelines[0], state);
  const stdoutParts = [result.stdout];
  const stderrParts = [result.stderr];

  for (let i = 0; i < list.operators.length; i += 1) {
    if (state.returning) break;
    const shouldRun = list.operators[i] === "&&" ? result.exitCode === 0 : result.exitCode !== 0;
    if (!shouldRun) continue;

    result = runPipeline(list.pipelines[i + 1], state);
    stdoutParts.push(result.stdout);
    stderrParts.push(result.stderr);
  }

  return { stdout: stdoutParts.join(""), stderr: stderrParts.join(""), exitCode: result.exitCode };
}

/**
 * `;`/改行で区切られた文の並び(スクリプト本体、または制御構造・関数の本体)を上から順に実行する。
 * 実行中に `return`(関数本体内)が発動した場合は、その時点までの出力を保持したまま処理を打ち切る
 * (呼び出し元の関数呼び出し処理が `state.returning` を検知して最終的な終了ステータスを確定させる)。
 */
export function runCompoundList(items: ScriptItem[], state: ShellState): CommandResult {
  let result: CommandResult = EMPTY_RESULT;
  const stdoutParts: string[] = [];
  const stderrParts: string[] = [];

  for (const item of items) {
    result = runAndOrList(item.andOr, state);
    state.lastExitCode = result.exitCode;
    stdoutParts.push(result.stdout);
    stderrParts.push(result.stderr);
    if (state.returning) break;
  }

  return { stdout: stdoutParts.join(""), stderr: stderrParts.join(""), exitCode: result.exitCode };
}

function runIfClause(node: IfClause, state: ShellState): CommandResult {
  const stdoutParts: string[] = [];
  const stderrParts: string[] = [];

  for (const branch of node.branches) {
    const conditionResult = runCompoundList(branch.condition, state);
    stdoutParts.push(conditionResult.stdout);
    stderrParts.push(conditionResult.stderr);
    if (state.returning) {
      return { stdout: stdoutParts.join(""), stderr: stderrParts.join(""), exitCode: conditionResult.exitCode };
    }

    if (conditionResult.exitCode === 0) {
      const bodyResult = runCompoundList(branch.body, state);
      stdoutParts.push(bodyResult.stdout);
      stderrParts.push(bodyResult.stderr);
      state.lastExitCode = bodyResult.exitCode;
      return { stdout: stdoutParts.join(""), stderr: stderrParts.join(""), exitCode: bodyResult.exitCode };
    }
  }

  if (node.elseBody) {
    const bodyResult = runCompoundList(node.elseBody, state);
    stdoutParts.push(bodyResult.stdout);
    stderrParts.push(bodyResult.stderr);
    state.lastExitCode = bodyResult.exitCode;
    return { stdout: stdoutParts.join(""), stderr: stderrParts.join(""), exitCode: bodyResult.exitCode };
  }

  state.lastExitCode = 0;
  return { stdout: stdoutParts.join(""), stderr: stderrParts.join(""), exitCode: 0 };
}

function runForClause(node: ForClause, state: ShellState): CommandResult {
  const items = node.words ? node.words.map((word) => expandWord(word, state)) : [...state.positionalParams];
  const stdoutParts: string[] = [];
  const stderrParts: string[] = [];
  let exitCode = 0;
  let iterations = 0;

  for (const item of items) {
    iterations += 1;
    if (iterations > MAX_LOOP_ITERATIONS) {
      throw new ShellRuntimeError("for: ループの反復回数が上限を超えました");
    }

    state.context.env[node.varName] = item;
    const bodyResult = runCompoundList(node.body, state);
    stdoutParts.push(bodyResult.stdout);
    stderrParts.push(bodyResult.stderr);
    exitCode = bodyResult.exitCode;
    if (state.returning) break;
  }

  state.lastExitCode = exitCode;
  return { stdout: stdoutParts.join(""), stderr: stderrParts.join(""), exitCode };
}

function runWhileClause(node: WhileClause, state: ShellState): CommandResult {
  const stdoutParts: string[] = [];
  const stderrParts: string[] = [];
  let exitCode = 0;
  let iterations = 0;

  for (;;) {
    const conditionResult = runCompoundList(node.condition, state);
    stdoutParts.push(conditionResult.stdout);
    stderrParts.push(conditionResult.stderr);
    if (state.returning) {
      exitCode = conditionResult.exitCode;
      break;
    }
    if (conditionResult.exitCode !== 0) break;

    iterations += 1;
    if (iterations > MAX_LOOP_ITERATIONS) {
      throw new ShellRuntimeError("while: ループの反復回数が上限を超えました");
    }

    const bodyResult = runCompoundList(node.body, state);
    stdoutParts.push(bodyResult.stdout);
    stderrParts.push(bodyResult.stderr);
    exitCode = bodyResult.exitCode;
    if (state.returning) break;
  }

  state.lastExitCode = exitCode;
  return { stdout: stdoutParts.join(""), stderr: stderrParts.join(""), exitCode };
}

function runCaseClause(node: CaseClause, state: ShellState): CommandResult {
  const subject = expandWord(node.word, state);

  for (const item of node.items) {
    const matched = item.patterns.some((pattern) => matchesCasePattern(expandWord(pattern, state), subject));
    if (!matched) continue;

    const bodyResult = runCompoundList(item.body, state);
    state.lastExitCode = bodyResult.exitCode;
    return bodyResult;
  }

  state.lastExitCode = 0;
  return { stdout: "", stderr: "", exitCode: 0 };
}

export function runScript(script: Script, state: ShellState): CommandResult {
  return runCompoundList(script.body, state);
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
    runCompoundList: (items) => runCompoundList(items, subshellState),
    functions: { ...parent.functions },
    positionalParams: [...parent.positionalParams],
    localFrames: [],
    // コマンド置換 $(...) は再帰呼び出しの経路として頻繁に使われるため(結果を受け取る唯一の
    // 手段が標準出力の捕捉であるため)、再帰段数の上限判定を素通りさせないよう親から引き継ぐ。
    callDepth: parent.callDepth,
  };
  return subshellState;
}

/** シェル入力文字列をパースして実行する、インタプリタの公開エントリポイント。 */
export function executeShellInput(input: string, context: CommandContext, argv: string[] = []): CommandResult {
  const script = parseScript(input);
  const state: ShellState = {
    context,
    lastExitCode: 0,
    runSubshell: (subScript) => runScript(subScript, createSubshellState(state)),
    runCompoundList: (items) => runCompoundList(items, state),
    functions: {},
    positionalParams: argv,
    localFrames: [],
    callDepth: 0,
  };
  return runScript(script, state);
}
