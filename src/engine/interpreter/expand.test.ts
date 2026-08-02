import { describe, expect, it } from "vitest";

import { buildContext } from "../commands/testFixtures";
import type { CommandContext } from "../commands";
import type { Word } from "../shell";
import { parseScript } from "../shell";
import { ShellRuntimeError } from "./errors";
import { expandWord, expandWordToFields } from "./expand";
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

describe("expandWordToFields: IFSによる単語分割", () => {
  it("クォートされていない変数展開の結果はデフォルトIFS(空白・タブ・改行)で分割される", () => {
    const state = buildState();
    state.context.env.LIST = "a b   c\td\ne";
    expect(expandWordToFields(nthWord("cmd $LIST", 1), state)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("先頭・末尾の空白系IFSは無視され、値が空文字列なら分割結果も空になる", () => {
    const state = buildState();
    state.context.env.LIST = "  a b  ";
    expect(expandWordToFields(nthWord("cmd $LIST", 1), state)).toEqual(["a", "b"]);

    state.context.env.EMPTY = "   ";
    expect(expandWordToFields(nthWord("cmd $EMPTY", 1), state)).toEqual([]);
  });

  it("ダブルクォートされた変数展開は分割されず1フィールドのまま", () => {
    const state = buildState();
    state.context.env.LIST = "a b c";
    expect(expandWordToFields(nthWord('cmd "$LIST"', 1), state)).toEqual(["a b c"]);
  });

  it("リテラルなテキスト(引用符なし)は元々空白で区切られているため分割の対象にならない", () => {
    const state = buildState();
    expect(expandWordToFields(nthWord("cmd plain-text", 1), state)).toEqual(["plain-text"]);
  });

  it("IFSを変更すると、その文字を区切りとして分割する(非空白文字は連続すると空フィールドを生む)", () => {
    const state = buildState();
    state.context.env.IFS = ":";
    state.context.env.LIST = "a::b:c";
    expect(expandWordToFields(nthWord("cmd $LIST", 1), state)).toEqual(["a", "", "b", "c"]);
  });

  it("IFSを空文字列にすると単語分割が一切行われない", () => {
    const state = buildState();
    state.context.env.IFS = "";
    state.context.env.LIST = "a b c";
    expect(expandWordToFields(nthWord("cmd $LIST", 1), state)).toEqual(["a b c"]);
  });

  it("コマンド置換 $(...) の結果もIFSで分割される", () => {
    const state = buildState(buildContext(undefined, "/home/study"));
    expect(expandWordToFields(nthWord("cmd $(echo a b c)", 1), state)).toEqual(["a", "b", "c"]);
  });
});
