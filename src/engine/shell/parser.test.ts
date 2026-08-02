import { describe, expect, it } from "vitest";

import type { Command, SimpleCommand } from "./ast";
import { ShellSyntaxError } from "./errors";
import { parseScript } from "./parser";

function asSimpleCommand(command: Command): SimpleCommand {
  if (command.type !== "SimpleCommand") {
    throw new Error(`expected a SimpleCommand, got ${command.type}`);
  }
  return command;
}

function firstCommand(input: string): SimpleCommand {
  const script = parseScript(input);
  return asSimpleCommand(script.body[0].andOr.pipelines[0].commands[0]);
}

function wordText(cmd: Command, index: number): string {
  const simple = asSimpleCommand(cmd);
  const parts = simple.words[index].parts;
  if (parts.length !== 1 || parts[0].type !== "Text") {
    throw new Error(`word ${index} is not a plain Text part: ${JSON.stringify(parts)}`);
  }
  return parts[0].value;
}

describe("parseScript: 単純コマンド", () => {
  it("コマンド名と引数をパースする", () => {
    const cmd = firstCommand("echo hello world");
    expect(wordText(cmd, 0)).toBe("echo");
    expect(wordText(cmd, 1)).toBe("hello");
    expect(wordText(cmd, 2)).toBe("world");
  });

  it("先頭の変数代入をAssignmentとして分離する", () => {
    const cmd = firstCommand("FOO=bar BAZ=qux env");
    expect(cmd.assignments).toEqual([
      { type: "Assignment", name: "FOO", value: { type: "Word", parts: [{ type: "Text", value: "bar" }] } },
      { type: "Assignment", name: "BAZ", value: { type: "Word", parts: [{ type: "Text", value: "qux" }] } },
    ]);
    expect(cmd.words).toHaveLength(1);
    expect(wordText(cmd, 0)).toBe("env");
  });

  it("代入のみのコマンド(引数なし)も許容する", () => {
    const cmd = firstCommand("FOO=bar");
    expect(cmd.assignments).toHaveLength(1);
    expect(cmd.words).toHaveLength(0);
  });

  it("コマンド名より後ろの NAME=value 形式は代入とみなさない", () => {
    const cmd = firstCommand("echo FOO=bar");
    expect(cmd.assignments).toHaveLength(0);
    expect(wordText(cmd, 1)).toBe("FOO=bar");
  });
});

describe("parseScript: パイプ・区切り", () => {
  it("パイプで連結された複数コマンドをPipelineにする", () => {
    const script = parseScript("ls -la | grep foo | wc -l");
    const pipeline = script.body[0].andOr.pipelines[0];
    expect(pipeline.commands).toHaveLength(3);
    expect(wordText(pipeline.commands[0], 0)).toBe("ls");
    expect(wordText(pipeline.commands[1], 0)).toBe("grep");
    expect(wordText(pipeline.commands[2], 0)).toBe("wc");
  });

  it("; で複数文に分割する", () => {
    const script = parseScript("echo a; echo b");
    expect(script.body).toHaveLength(2);
    expect(script.body[0].separator).toBe(";");
    expect(wordText(script.body[0].andOr.pipelines[0].commands[0], 1)).toBe("a");
    expect(wordText(script.body[1].andOr.pipelines[0].commands[0], 1)).toBe("b");
  });

  it("改行で複数文に分割する", () => {
    const script = parseScript("echo a\necho b\n");
    expect(script.body).toHaveLength(2);
    expect(script.body[0].separator).toBe("\n");
  });

  it("&& / || でAndOrListを構築する", () => {
    const script = parseScript("make build && make test || echo failed");
    const andOr = script.body[0].andOr;
    expect(andOr.pipelines).toHaveLength(3);
    expect(andOr.operators).toEqual(["&&", "||"]);
  });
});

describe("parseScript: リダイレクト", () => {
  it("> と >> を解決する(デフォルトfdは1)", () => {
    const cmd = firstCommand("cmd > out.txt");
    expect(cmd.redirects[0]).toMatchObject({ fd: 1, direction: "out", append: false, dup: false });
    const cmd2 = firstCommand("cmd >> out.txt");
    expect(cmd2.redirects[0]).toMatchObject({ fd: 1, direction: "out", append: true, dup: false });
  });

  it("< を解決する(デフォルトfdは0)", () => {
    const cmd = firstCommand("cmd < in.txt");
    expect(cmd.redirects[0]).toMatchObject({ fd: 0, direction: "in", append: false, dup: false });
  });

  it("明示的なfd番号付きリダイレクトを解決する", () => {
    const cmd = firstCommand("cmd 2> err.txt");
    expect(cmd.redirects[0]).toMatchObject({ fd: 2, direction: "out", append: false, dup: false });
  });

  it("N>&M 形式のfd複製を解決する", () => {
    const cmd = firstCommand("cmd 2>&1");
    expect(cmd.redirects[0]).toMatchObject({
      fd: 2,
      direction: "out",
      dup: true,
      target: { kind: "fd", fd: 1 },
    });
  });

  it("複数のリダイレクトを順序通り保持する", () => {
    const cmd = firstCommand("cmd < in.txt > out.txt 2>&1");
    expect(cmd.redirects).toHaveLength(3);
  });
});

describe("parseScript: 未対応構文・エラー", () => {
  it("select/time/until等の未対応予約語はShellSyntaxErrorになる", () => {
    expect(() => parseScript("select x in a b; do echo $x; done")).toThrow(ShellSyntaxError);
    expect(() => parseScript("until false; do echo x; done")).toThrow(ShellSyntaxError);
  });

  it("対応する構造の無い fi/done/esac 単体はShellSyntaxErrorになる", () => {
    expect(() => parseScript("fi")).toThrow(ShellSyntaxError);
  });

  it("引数中のifは予約語エラーにならない", () => {
    const cmd = firstCommand("echo if");
    expect(wordText(cmd, 1)).toBe("if");
  });

  it("クォートされたifは予約語エラーにならない", () => {
    const cmd = firstCommand('"if" true');
    expect(cmd.words).toHaveLength(2);
  });

  it("パイプの後にコマンドが無い場合はエラー", () => {
    expect(() => parseScript("echo hi |")).toThrow(ShellSyntaxError);
  });

  it("先頭がパイプの場合はエラー", () => {
    expect(() => parseScript("| echo hi")).toThrow(ShellSyntaxError);
  });

  it("リダイレクト先が無い場合はエラー", () => {
    expect(() => parseScript("echo hi >")).toThrow(ShellSyntaxError);
  });
});

describe("parseScript: 変数展開・コマンド置換を含む実践的な例", () => {
  it("複合的なスクリプトを一通りパースできる", () => {
    const script = parseScript(
      'name="$1"; echo "Hello, ${name:-world}! count=$(( 1 + 2 )) files=$(ls "$HOME" | wc -l)" > greeting.txt',
    );
    expect(script.body).toHaveLength(2);
    const second = script.body[1].andOr.pipelines[0].commands[0];
    if (second.type !== "SimpleCommand") throw new Error("expected a SimpleCommand");
    expect(wordText(second, 0)).toBe("echo");
    expect(second.redirects[0]).toMatchObject({ fd: 1, direction: "out" });
  });
});

describe("parseScript: 制御構造", () => {
  it("if/then/fi をパースする(elif/elseなし)", () => {
    const script = parseScript("if true; then echo yes; fi");
    const command = script.body[0].andOr.pipelines[0].commands[0];
    if (command.type !== "IfClause") throw new Error("expected an IfClause");
    expect(command.branches).toHaveLength(1);
    expect(command.branches[0].condition).toHaveLength(1);
    expect(command.branches[0].body).toHaveLength(1);
    expect(command.elseBody).toBeUndefined();
  });

  it("elif/elseを複数連ねてパースする", () => {
    const script = parseScript(
      "if false; then echo a; elif false; then echo b; elif true; then echo c; else echo d; fi",
    );
    const command = script.body[0].andOr.pipelines[0].commands[0];
    if (command.type !== "IfClause") throw new Error("expected an IfClause");
    expect(command.branches).toHaveLength(3);
    expect(command.elseBody).toHaveLength(1);
  });

  it("if 本体が無い場合はエラー(then の直前にキーワードが必要)", () => {
    expect(() => parseScript("if true then echo hi; fi")).toThrow(ShellSyntaxError);
  });

  it("for/in/do/done をパースする", () => {
    const script = parseScript("for f in a b c; do echo $f; done");
    const command = script.body[0].andOr.pipelines[0].commands[0];
    if (command.type !== "ForClause") throw new Error("expected a ForClause");
    expect(command.varName).toBe("f");
    expect(command.words).toHaveLength(3);
    expect(command.body).toHaveLength(1);
  });

  it("for のin句省略時はwordsがundefinedになる(位置パラメータを使う合図)", () => {
    const script = parseScript("for f; do echo $f; done");
    const command = script.body[0].andOr.pipelines[0].commands[0];
    if (command.type !== "ForClause") throw new Error("expected a ForClause");
    expect(command.words).toBeUndefined();
  });

  it("while/do/done をパースする", () => {
    const script = parseScript("while [ -f x ]; do echo x; done");
    const command = script.body[0].andOr.pipelines[0].commands[0];
    if (command.type !== "WhileClause") throw new Error("expected a WhileClause");
    expect(command.condition).toHaveLength(1);
    expect(command.body).toHaveLength(1);
  });

  it("case/in/esac をパースし、パターンの | 区切りを保持する", () => {
    const script = parseScript('case "$1" in y|yes) echo ok;; n|no) echo ng;; *) echo default;; esac');
    const command = script.body[0].andOr.pipelines[0].commands[0];
    if (command.type !== "CaseClause") throw new Error("expected a CaseClause");
    expect(command.items).toHaveLength(3);
    expect(command.items[0].patterns).toHaveLength(2);
    expect(command.items[2].patterns).toHaveLength(1);
  });

  it("caseの最後の項目は ;; を省略できる", () => {
    const script = parseScript("case x in x) echo hit; esac");
    const command = script.body[0].andOr.pipelines[0].commands[0];
    if (command.type !== "CaseClause") throw new Error("expected a CaseClause");
    expect(command.items).toHaveLength(1);
  });
});

describe("parseScript: 関数定義", () => {
  it("NAME() { ... } 形式をパースする", () => {
    const script = parseScript("greet() { echo hello; }");
    const command = script.body[0].andOr.pipelines[0].commands[0];
    if (command.type !== "FunctionDefinition") throw new Error("expected a FunctionDefinition");
    expect(command.name).toBe("greet");
    expect(command.body).toHaveLength(1);
  });

  it("function NAME { ... } 形式(括弧省略)をパースする", () => {
    const script = parseScript("function greet { echo hello; }");
    const command = script.body[0].andOr.pipelines[0].commands[0];
    if (command.type !== "FunctionDefinition") throw new Error("expected a FunctionDefinition");
    expect(command.name).toBe("greet");
  });

  it("再帰呼び出しを含む関数本体もパースできる", () => {
    const script = parseScript("fact() { if [ $1 -le 1 ]; then echo 1; else fact $(( $1 - 1 )); fi; }");
    const command = script.body[0].andOr.pipelines[0].commands[0];
    if (command.type !== "FunctionDefinition") throw new Error("expected a FunctionDefinition");
    expect(command.body).toHaveLength(1);
  });
});
