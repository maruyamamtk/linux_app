import { describe, expect, it } from "vitest";

import { buildContext } from "../commands/testFixtures";
import type { CommandContext } from "../commands";
import type { Word } from "../shell";
import { parseScript } from "../shell";
import { ShellRuntimeError } from "./errors";
import { expandWord } from "./expand";
import { runCompoundList, runScript } from "./interpreter";
import type { ShellState } from "./types";

function nthWord(input: string, index: number): Word {
  const script = parseScript(input);
  const command = script.body[0].andOr.pipelines[0].commands[0];
  if (command.type !== "SimpleCommand") throw new Error("expected a SimpleCommand");
  return command.words[index];
}

function buildState(context: CommandContext = buildContext()): ShellState {
  const state: ShellState = {
    context,
    lastExitCode: 0,
    runSubshell: (script) =>
      runScript(script, buildState({ ...context, env: { ...context.env } })),
    runCompoundList: (items) => runCompoundList(items, state),
    functions: {},
    positionalParams: [],
    localFrames: [],
    callDepth: 0,
  };
  return state;
}

describe("expandWord", () => {
  it("クォートなしのテキストはそのまま展開する", () => {
    expect(expandWord(nthWord("cmd plain-text", 1), buildState())).toBe("plain-text");
  });

  it("シングルクォート内は展開せずリテラルとして扱う", () => {
    expect(expandWord(nthWord("cmd 'literal $NOTSET here'", 1), buildState())).toBe(
      "literal $NOTSET here",
    );
  });

  it("環境変数を展開する。未設定の場合は空文字列になる", () => {
    const state = buildState();
    state.context.env.FOO = "bar";
    expect(expandWord(nthWord("cmd $FOO", 1), state)).toBe("bar");
    expect(expandWord(nthWord("cmd $UNSET", 1), state)).toBe("");
  });

  it("${var:-default} は未設定・空文字列の場合にデフォルト値を返す", () => {
    const state = buildState();
    expect(expandWord(nthWord("cmd ${VAR:-default}", 1), state)).toBe("default");

    state.context.env.VAR = "";
    expect(expandWord(nthWord("cmd ${VAR:-default}", 1), state)).toBe("default");

    state.context.env.VAR = "set-value";
    expect(expandWord(nthWord("cmd ${VAR:-default}", 1), state)).toBe("set-value");
  });

  it("${var:=default} は未設定・空文字列の場合にデフォルト値を代入する", () => {
    const state = buildState();
    expect(expandWord(nthWord("cmd ${VAR:=default}", 1), state)).toBe("default");
    expect(state.context.env.VAR).toBe("default");
  });

  it("${var:?message} は未設定・空文字列の場合に例外を投げる", () => {
    const state = buildState();
    expect(() => expandWord(nthWord("cmd ${VAR:?not set}", 1), state)).toThrow(ShellRuntimeError);
    expect(() => expandWord(nthWord("cmd ${VAR:?not set}", 1), state)).toThrow(/not set/);
  });

  it("${#var} は値の文字数を返す", () => {
    const state = buildState();
    state.context.env.FOO = "hello";
    expect(expandWord(nthWord("cmd ${#FOO}", 1), state)).toBe("5");
  });

  it("コマンド置換 $(...) はサブシェルでコマンドを実行し、末尾の改行を取り除いて展開する", () => {
    const state = buildState(buildContext(undefined, "/home/study"));
    expect(expandWord(nthWord("cmd $(pwd)", 1), state)).toBe("/home/study");
  });

  it("算術展開 $((...)) は式を評価して数値の文字列を返す", () => {
    const state = buildState();
    expect(expandWord(nthWord("cmd $((2 + 3 * 4))", 1), state)).toBe("14");
  });
});

describe("expandWord: 位置パラメータ", () => {
  it("$1 $2 ... は positionalParams を1始まりで参照する", () => {
    const state = buildState();
    state.positionalParams = ["a", "b", "c"];
    expect(expandWord(nthWord("cmd $1", 1), state)).toBe("a");
    expect(expandWord(nthWord("cmd $2", 1), state)).toBe("b");
  });

  it("範囲外の位置パラメータは未設定として空文字列になる", () => {
    const state = buildState();
    state.positionalParams = ["a"];
    expect(expandWord(nthWord("cmd $9", 1), state)).toBe("");
  });

  it("$# は位置パラメータの個数になる", () => {
    const state = buildState();
    state.positionalParams = ["a", "b", "c"];
    expect(expandWord(nthWord("cmd $#", 1), state)).toBe("3");
  });

  it("$@ $* は位置パラメータをスペース区切りで連結する", () => {
    const state = buildState();
    state.positionalParams = ["a", "b", "c"];
    expect(expandWord(nthWord("cmd $@", 1), state)).toBe("a b c");
    expect(expandWord(nthWord("cmd $*", 1), state)).toBe("a b c");
  });
});
