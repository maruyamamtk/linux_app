import { describe, expect, it } from "vitest";

import { ShellSyntaxError } from "./errors";
import { tokenize } from "./lexer";
import type { Token } from "./lexer";
import type { Script } from "./ast";

const emptyScript: Script = { type: "Script", commands: [] };
const noopResolve = () => emptyScript;

function tokenTypes(source: string): string[] {
  return tokenize(source, noopResolve).map((token) =>
    token.type === "Operator" ? `Operator(${token.value})` : token.type,
  );
}

describe("tokenize", () => {
  it("純粋な数字の並びが< or >の直前にある場合のみIoNumberにする", () => {
    expect(tokenTypes("2>file")).toEqual(["IoNumber", "Operator(>)", "Word", "EOF"]);
    expect(tokenTypes("22file>out")).toEqual(["Word", "Operator(>)", "Word", "EOF"]);
    expect(tokenTypes("echo 2 file")).toEqual(["Word", "Word", "Word", "EOF"]);
  });

  it("'#'は単語先頭でのみコメント開始として扱う", () => {
    expect(tokenTypes("echo hi # comment")).toEqual(["Word", "Word", "EOF"]);
    const tokens = tokenize("foo#bar", noopResolve);
    expect(tokens[0]).toMatchObject({ type: "Word" });
    if (tokens[0].type === "Word") {
      expect(tokens[0].word.parts).toEqual([{ type: "Literal", value: "foo#bar" }]);
    }
  });

  it("演算子(| || & && ; > >> < >& <&)を正しく分割する", () => {
    expect(tokenTypes("a|b")).toEqual(["Word", "Operator(|)", "Word", "EOF"]);
    expect(tokenTypes("a||b")).toEqual(["Word", "Operator(||)", "Word", "EOF"]);
    expect(tokenTypes("a&&b")).toEqual(["Word", "Operator(&&)", "Word", "EOF"]);
    expect(tokenTypes("a;b")).toEqual(["Word", "Operator(;)", "Word", "EOF"]);
    expect(tokenTypes("a>b")).toEqual(["Word", "Operator(>)", "Word", "EOF"]);
    expect(tokenTypes("a>>b")).toEqual(["Word", "Operator(>>)", "Word", "EOF"]);
    expect(tokenTypes("a<b")).toEqual(["Word", "Operator(<)", "Word", "EOF"]);
    expect(tokenTypes("a>&1")).toEqual(["Word", "Operator(>&)", "Word", "EOF"]);
    expect(tokenTypes("a<&1")).toEqual(["Word", "Operator(<&)", "Word", "EOF"]);
  });

  it("改行はNewlineトークンになる", () => {
    expect(tokenTypes("a\nb")).toEqual(["Word", "Newline", "Word", "EOF"]);
  });

  it("ヒアドキュメント・サブシェル・バックグラウンド実行は明確なエラーメッセージで拒否する", () => {
    expect(() => tokenize("cmd <<EOF", noopResolve)).toThrow(ShellSyntaxError);
    expect(() => tokenize("(cmd)", noopResolve)).toThrow(ShellSyntaxError);
    expect(() => tokenize("cmd &", noopResolve)).toThrow(ShellSyntaxError);
  });

  it("'&'単体のエラーメッセージにバックグラウンド実行の旨を含む", () => {
    expect(() => tokenize("cmd &", noopResolve)).toThrow(/バックグラウンド実行/);
  });
});

describe("tokenize / word position", () => {
  it("各トークンが元のソース上の位置を保持する", () => {
    const tokens: Token[] = tokenize("echo hi", noopResolve);
    expect(tokens[0].position).toBe(0);
    expect(tokens[1].position).toBe(5);
  });
});
