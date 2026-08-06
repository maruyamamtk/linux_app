import { describe, expect, it } from "vitest";

import { tokenizeShellLine } from "./shellSyntaxHighlight";

function types(line: string): string[] {
  return tokenizeShellLine(line).map((token) => token.type);
}

function texts(line: string): string[] {
  return tokenizeShellLine(line).map((token) => token.text);
}

describe("tokenizeShellLine", () => {
  it("行頭の#以降をコメントとして扱う", () => {
    const tokens = tokenizeShellLine('echo hi # comment $NAME');
    expect(tokens[tokens.length - 1]).toEqual({ type: "comment", text: "# comment $NAME" });
  });

  it("シングルクォート文字列の中は展開せずそのまま1トークンにする", () => {
    const tokens = tokenizeShellLine("echo '$NAME is here'");
    expect(tokens).toContainEqual({ type: "string", text: "'$NAME is here'" });
  });

  it("ダブルクォート文字列の中の変数参照はvariableトークンとして分離する", () => {
    const tokens = tokenizeShellLine('echo "Hello, $NAME!"');
    expect(tokens).toContainEqual({ type: "variable", text: "$NAME" });
    expect(tokens.some((t) => t.type === "string" && t.text.includes("Hello"))).toBe(true);
  });

  it("$1 $@ $# 等の特殊パラメータもvariableとして認識する", () => {
    expect(texts('echo $1 $@ $# $?')).toEqual(
      expect.arrayContaining(["$1", "$@", "$#", "$?"]),
    );
  });

  it("${NAME:-default} のような波括弧付き展開もひとつのvariableトークンになる", () => {
    const tokens = tokenizeShellLine('echo ${NAME:-default}');
    expect(tokens).toContainEqual({ type: "variable", text: "${NAME:-default}" });
  });

  it("if/then/fi等の制御構造キーワードをkeywordとして認識する", () => {
    expect(types('if true; then echo ok; fi')).toEqual(
      expect.arrayContaining(["keyword", "keyword", "keyword"]),
    );
  });

  it("パイプ・リダイレクト等の演算子記号をoperatorとして認識する", () => {
    const tokens = tokenizeShellLine("cat a.txt | grep foo >> out.txt");
    expect(tokens).toContainEqual({ type: "operator", text: "|" });
    expect(tokens).toContainEqual({ type: "operator", text: ">>" });
  });

  it("閉じられていないクォートでも例外を投げず末尾まで文字列として扱う(入力途中の状態への耐性)", () => {
    expect(() => tokenizeShellLine('echo "unterminated')).not.toThrow();
    const tokens = tokenizeShellLine('echo "unterminated');
    expect(tokens.some((t) => t.type === "string")).toBe(true);
  });

  it("空行はトークンなしになる", () => {
    expect(tokenizeShellLine("")).toEqual([]);
  });
});
