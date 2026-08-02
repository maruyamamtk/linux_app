import { describe, expect, it } from "vitest";

import { ShellSyntaxError } from "./errors";
import { tokenize } from "./lexer";
import type { WordToken } from "./lexer";

function words(input: string): WordToken[] {
  return tokenize(input).filter((t): t is WordToken => t.type === "WORD");
}

describe("tokenize: 単語の基本形", () => {
  it("空白区切りの単語をWORDトークンに分割する", () => {
    const tokens = tokenize("echo hello world");
    expect(tokens.map((t) => t.type)).toEqual(["WORD", "WORD", "WORD", "EOF"]);
  });

  it("シングルクォートは展開せずそのまま保持する", () => {
    const [cmd, arg] = words("echo 'a $b `c` $((1+1))'");
    expect(cmd.raw).toBe("echo");
    expect(arg.word.parts).toEqual([{ type: "SingleQuoted", value: "a $b `c` $((1+1))" }]);
  });

  it("ダブルクォート内は変数展開・コマンド置換を解決する", () => {
    const [, arg] = words('echo "hello $name"');
    expect(arg.word.parts).toEqual([
      { type: "Text", value: "hello " },
      { type: "ParameterExpansion", name: "name" },
    ]);
  });

  it("バックスラッシュエスケープを解決する", () => {
    const [, arg] = words("echo a\\ b\\$c");
    expect(arg.word.parts).toEqual([{ type: "Text", value: "a b$c" }]);
  });

  it("行継続(バックスラッシュ+改行)は単語をまたいで結合する", () => {
    const [, arg] = words("echo foo\\\nbar");
    expect(arg.word.parts).toEqual([{ type: "Text", value: "foobar" }]);
  });
});

describe("tokenize: 変数展開", () => {
  it("$var 形式を解決する", () => {
    const [, arg] = words("echo $HOME");
    expect(arg.word.parts).toEqual([{ type: "ParameterExpansion", name: "HOME" }]);
  });

  it("${var} 形式を解決する", () => {
    const [, arg] = words("echo ${HOME}");
    expect(arg.word.parts).toEqual([{ type: "ParameterExpansion", name: "HOME" }]);
  });

  it("位置パラメータ・特殊パラメータを解決する", () => {
    const [, a, b, c, d] = words("echo $1 $? $@ $#");
    expect(a.word.parts).toEqual([{ type: "ParameterExpansion", name: "1" }]);
    expect(b.word.parts).toEqual([{ type: "ParameterExpansion", name: "?" }]);
    expect(c.word.parts).toEqual([{ type: "ParameterExpansion", name: "@" }]);
    expect(d.word.parts).toEqual([{ type: "ParameterExpansion", name: "#" }]);
  });

  it("${var:-default} 形式のデフォルト値演算子を解決する", () => {
    const [, arg] = words("echo ${name:-guest}");
    expect(arg.word.parts).toEqual([
      {
        type: "ParameterExpansion",
        name: "name",
        operator: ":-",
        word: { type: "Word", parts: [{ type: "Text", value: "guest" }] },
      },
    ]);
  });

  it("${#var} 形式の長さ取得を解決する", () => {
    const [, arg] = words("echo ${#name}");
    expect(arg.word.parts).toEqual([{ type: "ParameterExpansion", name: "name", length: true }]);
  });
});

describe("tokenize: コマンド置換・算術展開", () => {
  it("$(cmd) 形式を再帰的にパースする", () => {
    const [, arg] = words("echo $(ls -la)");
    expect(arg.word.parts).toHaveLength(1);
    const part = arg.word.parts[0];
    expect(part.type).toBe("CommandSubstitution");
    if (part.type !== "CommandSubstitution") throw new Error("unreachable");
    expect(part.script.body).toHaveLength(1);
    const cmd = part.script.body[0].andOr.pipelines[0].commands[0];
    if (cmd.type !== "SimpleCommand") throw new Error("unreachable");
    expect(cmd.words.map((w) => w.parts)).toEqual([
      [{ type: "Text", value: "ls" }],
      [{ type: "Text", value: "-la" }],
    ]);
  });

  it("ネストした $() を解決する", () => {
    const [, arg] = words("echo $(echo $(echo inner))");
    const outer = arg.word.parts[0];
    if (outer.type !== "CommandSubstitution") throw new Error("unreachable");
    const outerCmd = outer.script.body[0].andOr.pipelines[0].commands[0];
    if (outerCmd.type !== "SimpleCommand") throw new Error("unreachable");
    const innerPart = outerCmd.words[1].parts[0];
    expect(innerPart.type).toBe("CommandSubstitution");
  });

  it("バッククォート形式のコマンド置換を解決する", () => {
    const [, arg] = words("echo `date`");
    expect(arg.word.parts[0].type).toBe("CommandSubstitution");
  });

  it("$((expr)) は式を生テキストとして保持する", () => {
    const [, arg] = words("echo $((1 + 2 * (3 - 1)))");
    expect(arg.word.parts).toEqual([{ type: "ArithmeticExpansion", expression: "1 + 2 * (3 - 1)" }]);
  });
});

describe("tokenize: 演算子・リダイレクト", () => {
  it("パイプ・区切りを識別する", () => {
    const tokens = tokenize("ls | grep foo; echo done && echo ok || echo ng");
    const ops = tokens.filter((t) => t.type === "OPERATOR").map((t) => (t as { value: string }).value);
    expect(ops).toEqual(["|", ";", "&&", "||"]);
  });

  it("リダイレクト演算子とIO番号を識別する", () => {
    const tokens = tokenize("cmd > out.txt 2>> err.log 2>&1 < in.txt");
    const kinds = tokens.filter((t) => t.type !== "WORD").map((t) => t.type);
    expect(kinds).toEqual(["OPERATOR", "IO_NUMBER", "OPERATOR", "IO_NUMBER", "OPERATOR", "OPERATOR", "EOF"]);
  });

  it("コメントを読み飛ばす", () => {
    const tokens = tokenize("echo hi # this is a comment\necho bye");
    expect(tokens.map((t) => t.type)).toEqual(["WORD", "WORD", "NEWLINE", "WORD", "WORD", "EOF"]);
  });

  it("( ) ;; を識別する(関数定義・caseで使用)", () => {
    const tokens = tokenize("greet() { :;; } ;;");
    const ops = tokens.filter((t) => t.type === "OPERATOR").map((t) => (t as { value: string }).value);
    expect(ops).toEqual(["(", ")", ";;", ";;"]);
  });
});

describe("tokenize: 未対応構文はShellSyntaxErrorになる", () => {
  it("バックグラウンド実行(&)", () => {
    expect(() => tokenize("sleep 1 &")).toThrow(ShellSyntaxError);
  });

  it("ヒアドキュメント(<<)", () => {
    expect(() => tokenize("cat <<EOF")).toThrow(ShellSyntaxError);
  });

  it("閉じられていないシングルクォート", () => {
    expect(() => tokenize("echo 'unterminated")).toThrow(ShellSyntaxError);
  });

  it("閉じられていないダブルクォート", () => {
    expect(() => tokenize('echo "unterminated')).toThrow(ShellSyntaxError);
  });

  it("閉じられていないコマンド置換", () => {
    expect(() => tokenize("echo $(ls")).toThrow(ShellSyntaxError);
  });
});
