import { describe, expect, it } from "vitest";

import { ShellSyntaxError } from "./errors";
import { parseScript } from "./parser";
import type { SimpleCommand, Word } from "./ast";

function firstCommand(source: string): SimpleCommand {
  const script = parseScript(source);
  return script.commands[0].pipelines[0].commands[0];
}

function literal(value: string) {
  return { type: "Literal", value };
}

describe("parseScript / 単純コマンド", () => {
  it("コマンド名と引数を単語として解析する", () => {
    const command = firstCommand("echo hello world");
    expect(command.words).toEqual<Word[]>([
      { type: "Word", parts: [literal("echo")] },
      { type: "Word", parts: [literal("hello")] },
      { type: "Word", parts: [literal("world")] },
    ]);
  });

  it("空スクリプト・空白/コメントのみのスクリプトはコマンド0件になる", () => {
    expect(parseScript("").commands).toEqual([]);
    expect(parseScript("   \n  # just a comment\n").commands).toEqual([]);
  });

  it("行継続('\\'+改行)を単語の途中でも結合する", () => {
    const command = firstCommand("ec\\\nho hi");
    expect(command.words[0]).toEqual<Word>({ type: "Word", parts: [literal("echo")] });
  });
});

describe("parseScript / 変数展開", () => {
  it("$name / ${name} / 位置パラメータ / 特殊パラメータを解析する", () => {
    const command = firstCommand("echo $HOME ${USER} $1 $? $@ $$");
    expect(command.words.slice(1)).toEqual<Word[]>([
      { type: "Word", parts: [{ type: "Variable", name: "HOME", braced: false }] },
      { type: "Word", parts: [{ type: "Variable", name: "USER", braced: true }] },
      { type: "Word", parts: [{ type: "Variable", name: "1", braced: false }] },
      { type: "Word", parts: [{ type: "Variable", name: "?", braced: false }] },
      { type: "Word", parts: [{ type: "Variable", name: "@", braced: false }] },
      { type: "Word", parts: [{ type: "Variable", name: "$", braced: false }] },
    ]);
  });

  it("${name:-default} のようなパラメータ展開演算子は生テキストとして境界だけ切り出す", () => {
    const command = firstCommand("echo ${FOO:-default}");
    expect(command.words[1]).toEqual<Word>({
      type: "Word",
      parts: [{ type: "Variable", name: "FOO:-default", braced: true }],
    });
  });

  it("単語末尾の裸の$はリテラルとして扱う", () => {
    const command = firstCommand("echo price$");
    expect(command.words[1]).toEqual<Word>({ type: "Word", parts: [literal("price$")] });
  });
});

describe("parseScript / クォート", () => {
  it("シングルクォートは展開せずリテラルとして保持する", () => {
    const command = firstCommand("echo 'raw $HOME text'");
    expect(command.words[1]).toEqual<Word>({
      type: "Word",
      parts: [{ type: "SingleQuoted", value: "raw $HOME text" }],
    });
  });

  it("ダブルクォート内は変数展開が有効", () => {
    const command = firstCommand('echo "hello $USER!"');
    expect(command.words[1]).toEqual<Word>({
      type: "Word",
      parts: [
        {
          type: "DoubleQuoted",
          parts: [literal("hello "), { type: "Variable", name: "USER", braced: false }, literal("!")],
        },
      ],
    });
  });

  it("クォート境界をまたいでも1つの単語として結合する", () => {
    const command = firstCommand(`mix'ed'"quo"ting`);
    expect(command.words[0]).toEqual<Word>({
      type: "Word",
      parts: [
        literal("mix"),
        { type: "SingleQuoted", value: "ed" },
        { type: "DoubleQuoted", parts: [literal("quo")] },
        literal("ting"),
      ],
    });
  });

  it("閉じられていないクォートはShellSyntaxErrorになる", () => {
    expect(() => parseScript("echo 'unterminated")).toThrow(ShellSyntaxError);
    expect(() => parseScript('echo "unterminated')).toThrow(ShellSyntaxError);
  });
});

describe("parseScript / コマンド置換", () => {
  it("$(...) 形式を再帰的にパースする", () => {
    const command = firstCommand("echo $(ls -la)");
    const word = command.words[1];
    expect(word.parts).toHaveLength(1);
    const part = word.parts[0];
    if (part.type !== "CommandSubstitution") throw new Error("expected CommandSubstitution");
    expect(part.style).toBe("dollar");
    expect(part.command.commands[0].pipelines[0].commands[0].words).toEqual<Word[]>([
      { type: "Word", parts: [literal("ls")] },
      { type: "Word", parts: [literal("-la")] },
    ]);
  });

  it("バッククォート形式を解析する", () => {
    const command = firstCommand("echo `pwd`");
    const part = command.words[1].parts[0];
    if (part.type !== "CommandSubstitution") throw new Error("expected CommandSubstitution");
    expect(part.style).toBe("backtick");
    expect(part.command.commands[0].pipelines[0].commands[0].words).toEqual<Word[]>([
      { type: "Word", parts: [literal("pwd")] },
    ]);
  });

  it("ダブルクォート内でもコマンド置換を解析する", () => {
    const command = firstCommand('echo "result: $(echo ok)"');
    const dq = command.words[1].parts[0];
    if (dq.type !== "DoubleQuoted") throw new Error("expected DoubleQuoted");
    expect(dq.parts[1].type).toBe("CommandSubstitution");
  });

  it("ネストしたコマンド置換を解析する", () => {
    const command = firstCommand("echo $(echo $(echo inner))");
    const outer = command.words[1].parts[0];
    if (outer.type !== "CommandSubstitution") throw new Error("expected CommandSubstitution");
    const innerWord = outer.command.commands[0].pipelines[0].commands[0].words[1];
    expect(innerWord.parts[0].type).toBe("CommandSubstitution");
  });

  it("閉じられていないコマンド置換はShellSyntaxErrorになる", () => {
    expect(() => parseScript("echo $(ls -la")).toThrow(ShellSyntaxError);
  });
});

describe("parseScript / 算術展開", () => {
  it("$((...)) の中身を式の生テキストとして保持する", () => {
    const command = firstCommand("echo $((1 + 2 * 3))");
    expect(command.words[1]).toEqual<Word>({
      type: "Word",
      parts: [{ type: "ArithmeticExpansion", expression: "1 + 2 * 3" }],
    });
  });

  it("ネストした括弧を含む算術式を正しく閉じる", () => {
    const command = firstCommand("echo $(( (1 + 2) * 3 ))");
    expect(command.words[1]).toEqual<Word>({
      type: "Word",
      parts: [{ type: "ArithmeticExpansion", expression: " (1 + 2) * 3 " }],
    });
  });
});

describe("parseScript / パイプ", () => {
  it("複数のコマンドをパイプで連結する", () => {
    const script = parseScript("ls | grep foo | wc -l");
    const pipeline = script.commands[0].pipelines[0];
    expect(pipeline.commands).toHaveLength(3);
    expect(pipeline.commands[0].words[0]).toEqual<Word>({ type: "Word", parts: [literal("ls")] });
    expect(pipeline.commands[2].words).toEqual<Word[]>([
      { type: "Word", parts: [literal("wc")] },
      { type: "Word", parts: [literal("-l")] },
    ]);
  });
});

describe("parseScript / リダイレクト", () => {
  it("> >> < を解析し、fdのデフォルト値を適切に補う", () => {
    expect(firstCommand("cmd > out.txt").redirections[0]).toMatchObject({
      fd: 1,
      operator: ">",
      target: { type: "File", word: { type: "Word", parts: [literal("out.txt")] } },
    });
    expect(firstCommand("cmd >> out.txt").redirections[0]).toMatchObject({ fd: 1, operator: ">>" });
    expect(firstCommand("cmd < in.txt").redirections[0]).toMatchObject({ fd: 0, operator: "<" });
  });

  it("fdを指定したリダイレクト(2>)を解析する", () => {
    expect(firstCommand("cmd 2> err.txt").redirections[0]).toMatchObject({ fd: 2, operator: ">" });
  });

  it("fd複製(2>&1)を解析する", () => {
    expect(firstCommand("cmd 2>&1").redirections[0]).toMatchObject({
      fd: 2,
      operator: ">&",
      target: { type: "FdDuplicate", fd: 1 },
    });
  });

  it("複数のリダイレクトをコマンド前後どちらでも解析する", () => {
    const command = firstCommand("> out.txt cmd < in.txt 2>&1");
    expect(command.redirections).toHaveLength(3);
    expect(command.words).toEqual<Word[]>([{ type: "Word", parts: [literal("cmd")] }]);
  });

  it("fd複製先が数字でない場合はShellSyntaxErrorになる", () => {
    expect(() => parseScript("cmd 2>&foo")).toThrow(ShellSyntaxError);
  });
});

describe("parseScript / ; && ||", () => {
  it("';'で複数コマンドに分割する", () => {
    const script = parseScript("echo a; echo b");
    expect(script.commands).toHaveLength(2);
  });

  it("末尾の';'は許容する", () => {
    const script = parseScript("echo a;");
    expect(script.commands).toHaveLength(1);
  });

  it("'&&'/'||'で1つのAndOrListとして連結する", () => {
    const script = parseScript("cmd1 && cmd2 || cmd3");
    const andOr = script.commands[0];
    expect(andOr.pipelines).toHaveLength(3);
    expect(andOr.operators).toEqual(["&&", "||"]);
  });

  it("';' と '&&'/'||' を組み合わせられる", () => {
    const script = parseScript("cmd1; cmd2 && cmd3 || cmd4");
    expect(script.commands).toHaveLength(2);
    expect(script.commands[1].operators).toEqual(["&&", "||"]);
  });

  it("';;' はコマンドが必要というShellSyntaxErrorになる", () => {
    expect(() => parseScript("echo a;;echo b")).toThrow(ShellSyntaxError);
  });
});

describe("parseScript / 変数代入", () => {
  it("コマンド名の前の NAME=value を代入として解析する", () => {
    const command = firstCommand("FOO=bar BAZ=$HOME cmd arg");
    expect(command.assignments).toEqual([
      { type: "Assignment", name: "FOO", value: { type: "Word", parts: [literal("bar")] } },
      {
        type: "Assignment",
        name: "BAZ",
        value: { type: "Word", parts: [{ type: "Variable", name: "HOME", braced: false }] },
      },
    ]);
    expect(command.words).toEqual<Word[]>([
      { type: "Word", parts: [literal("cmd")] },
      { type: "Word", parts: [literal("arg")] },
    ]);
  });

  it("コマンド名より後ろのNAME=valueは通常の引数として扱う", () => {
    const command = firstCommand("cmd FOO=bar");
    expect(command.assignments).toEqual([]);
    expect(command.words[1]).toEqual<Word>({ type: "Word", parts: [literal("FOO=bar")] });
  });

  it("代入のみでコマンド名がない場合も解析できる", () => {
    const command = firstCommand("FOO=bar");
    expect(command.words).toEqual([]);
    expect(command.assignments).toHaveLength(1);
  });
});

describe("parseScript / 未対応構文のエラー", () => {
  it("ヒアドキュメント('<<')はShellSyntaxErrorになる", () => {
    expect(() => parseScript("cmd <<EOF")).toThrow(ShellSyntaxError);
  });

  it("バックグラウンド実行('&')はShellSyntaxErrorになる", () => {
    expect(() => parseScript("cmd &")).toThrow(ShellSyntaxError);
  });

  it("サブシェル構文('(...)')はShellSyntaxErrorになる", () => {
    expect(() => parseScript("(cmd)")).toThrow(ShellSyntaxError);
  });

  it("コマンドが必要な位置に演算子しか無い場合はShellSyntaxErrorになる", () => {
    expect(() => parseScript("| cmd")).toThrow(ShellSyntaxError);
  });
});
