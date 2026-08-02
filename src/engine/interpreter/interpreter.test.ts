import { describe, expect, it } from "vitest";

import { buildContext } from "../commands/testFixtures";
import type { CommandContext } from "../commands";
import { parseScript } from "../shell";
import type { SimpleCommand } from "../shell";
import { executeShellInput } from "./interpreter";
import { resolveRedirects } from "./redirect";
import type { ShellState } from "./types";

function firstCommand(input: string): SimpleCommand {
  const command = parseScript(input).body[0].andOr.pipelines[0].commands[0];
  if (command.type !== "SimpleCommand") throw new Error("expected a SimpleCommand");
  return command;
}

function buildState(context: CommandContext): ShellState {
  return {
    context,
    lastExitCode: 0,
    runSubshell: () => {
      throw new Error("not used in these tests");
    },
    runCompoundList: () => {
      throw new Error("not used in these tests");
    },
    functions: {},
    positionalParams: [],
    localFrames: [],
    callDepth: 0,
  };
}

describe("executeShellInput: リダイレクト", () => {
  it("`>` は標準出力をファイルへ書き込み、端末には出力しない", () => {
    // listing.txt自身が/home/studyに作られるため、対象は変化しないdocs配下を`ls`する。
    const context = buildContext();
    const expected = executeShellInput("ls docs", buildContext()).stdout;

    const result = executeShellInput("ls docs > listing.txt", context);

    expect(result.stdout).toBe("");
    expect(result.exitCode).toBe(0);
    expect(context.vfs.readFile("/home/study/listing.txt")).toBe(expected);
  });

  it("`>` は既存ファイルを上書き(切り詰め)する", () => {
    const context = buildContext();
    context.vfs.writeFile("/home/study/listing.txt", "old content\n");

    executeShellInput("ls docs > listing.txt", context);

    expect(context.vfs.readFile("/home/study/listing.txt")).not.toContain("old content");
  });

  it("`>>` は既存ファイルの末尾に追記する", () => {
    const context = buildContext();

    executeShellInput("ls docs > listing.txt", context);
    const once = context.vfs.readFile("/home/study/listing.txt");
    executeShellInput("ls docs >> listing.txt", context);

    expect(context.vfs.readFile("/home/study/listing.txt")).toBe(once + once);
  });

  it("`2>` は標準エラー出力のみをファイルへ書き込む", () => {
    const context = buildContext();

    const result = executeShellInput("cd /nope 2> err.txt", context);

    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(1);
    expect(context.vfs.readFile("/home/study/err.txt")).toBe(
      "cd: /nope: No such file or directory",
    );
  });

  it("`> file 2>&1` は標準出力・標準エラー出力の両方を同じファイルへまとめる", () => {
    const context = buildContext();

    const result = executeShellInput("cd /nope > out.txt 2>&1", context);

    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(context.vfs.readFile("/home/study/out.txt")).toBe(
      "cd: /nope: No such file or directory",
    );
  });

  it("`2>&1 > file` は複製時点のfd1(端末)を使うため、標準エラー出力は端末に残る", () => {
    const context = buildContext();

    const result = executeShellInput("cd /nope 2>&1 > out.txt", context);

    expect(result.stderr).toBe("cd: /nope: No such file or directory");
    expect(context.vfs.readFile("/home/study/out.txt")).toBe("");
  });

  it("`1>&2` は標準出力をその時点の標準エラー出力の行き先へ複製する", () => {
    const context = buildContext();

    // まず2>でfd2をファイルへ向けておき、その後1>&2でfd1をそこへ複製する。
    const result = executeShellInput("echo hello 2> err.txt 1>&2", context);

    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(context.vfs.readFile("/home/study/err.txt")).toBe("hello\n");
  });

  it("ヒアドキュメント(`<<`)は標準入力として本文を渡す(変数展開込み)", () => {
    const context = buildContext();
    context.env.NAME = "world";

    const result = executeShellInput('cat <<EOF\nhello $NAME\nEOF', context);

    expect(result.stdout).toBe("hello world\n");
    expect(result.exitCode).toBe(0);
  });

  it("区切り文字をクォートしたヒアドキュメントは変数展開しない", () => {
    const context = buildContext();
    context.env.NAME = "world";

    const result = executeShellInput("cat <<'EOF'\nhello $NAME\nEOF", context);

    expect(result.stdout).toBe("hello $NAME\n");
  });

  it("`<<-` は本文各行・区切り文字行の先頭タブを除去する", () => {
    const context = buildContext();

    const result = executeShellInput("cat <<-EOF\n\tindented\nEOF", context);

    expect(result.stdout).toBe("indented\n");
  });

  it("`<` は存在しないファイルを指定するとエラーになりコマンドを実行しない", () => {
    const context = buildContext();
    const state = buildState(context);
    const redirects = firstCommand("dummy < missing.txt").redirects;

    const resolution = resolveRedirects(redirects, state);

    expect(resolution.error).toContain("No such file or directory");
    expect(resolution.stdinOverride).toBeUndefined();
  });

  it("`<` はファイルの内容を標準入力として読み込む", () => {
    const context = buildContext();
    context.vfs.writeFile("/home/study/in.txt", "hello\n");
    const state = buildState(context);
    const redirects = firstCommand("dummy < in.txt").redirects;

    const resolution = resolveRedirects(redirects, state);

    expect(resolution.stdinOverride).toBe("hello\n");
    expect(resolution.error).toBeUndefined();
  });

  it("/dev/null への書き込みは破棄され、読み込みは常に空文字列になる", () => {
    const context = buildContext();

    const result = executeShellInput("ls > /dev/null", context);

    expect(result.stdout).toBe("");
    expect(context.vfs.readFile("/dev/null")).toBe("");

    const state = buildState(context);
    const redirects = firstCommand("dummy < /dev/null").redirects;
    expect(resolveRedirects(redirects, state).stdinOverride).toBe("");
  });

  it("コマンドを伴わないリダイレクトのみの文でも、ファイルの作成/切り詰めは行う", () => {
    const context = buildContext();
    context.vfs.writeFile("/home/study/empty-target.txt", "old\n");

    const result = executeShellInput("> empty-target.txt", context);

    expect(result.exitCode).toBe(0);
    expect(context.vfs.readFile("/home/study/empty-target.txt")).toBe("");
  });
});

describe("executeShellInput: パイプライン", () => {
  it("`|` は最終段の標準出力を全体の出力として返し、終了コードも最終段のものになる", () => {
    const context = buildContext();
    const expectedPwd = executeShellInput("pwd", buildContext()).stdout;

    const result = executeShellInput("pwd | pwd | pwd", context);

    expect(result.stdout).toBe(expectedPwd);
    expect(result.exitCode).toBe(0);
  });

  it("パイプライン途中のコマンド自身のリダイレクトは、そのコマンドの出力を端末/パイプから外す", () => {
    const context = buildContext();
    const expectedPwd = executeShellInput("pwd", buildContext()).stdout;

    const result = executeShellInput("pwd > mid.txt | pwd", context);

    expect(context.vfs.readFile("/home/study/mid.txt")).toBe(expectedPwd);
    expect(result.stdout).toBe(expectedPwd);
  });

  it("いずれかの段が失敗しても後続の段は実行され、標準エラー出力は全段分が集約される", () => {
    const context = buildContext();

    const result = executeShellInput("cd /nope | pwd", context);

    expect(result.stderr).toBe("cd: /nope: No such file or directory");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("/home/study\n");
  });
});

describe("executeShellInput: 区切り・論理演算子・変数代入", () => {
  it("`;` で区切られた複数の文を順に実行する", () => {
    const context = buildContext();

    const result = executeShellInput("mkdir newdir; ls", context);

    expect(result.exitCode).toBe(0);
    expect(context.vfs.exists("/home/study/newdir")).toBe(true);
    expect(result.stdout).toContain("newdir");
  });

  it("`&&` は前段が成功した場合のみ後段を実行する", () => {
    const context = buildContext();

    const result = executeShellInput("cd /nope && mkdir should-not-exist", context);

    expect(result.exitCode).toBe(1);
    expect(context.vfs.exists("/home/study/should-not-exist")).toBe(false);
  });

  it("`||` は前段が失敗した場合のみ後段を実行する", () => {
    const context = buildContext();

    const result = executeShellInput("cd /nope || cd /home/study/docs", context);

    expect(result.exitCode).toBe(0);
    expect(context.cwd).toBe("/home/study/docs");
  });

  it("コマンドを伴う代入(`FOO=bar cmd`)は一時的にのみ環境変数へ反映される", () => {
    const context = buildContext();

    executeShellInput("FOO=temp pwd", context);

    expect(context.env.FOO).toBeUndefined();
  });

  it("コマンドを伴わない代入(`FOO=bar`)はセッションに永続反映され、以後の展開で使える", () => {
    const context = buildContext();

    executeShellInput("FOO=/home/study/docs; cd $FOO", context);

    expect(context.env.FOO).toBe("/home/study/docs");
    expect(context.cwd).toBe("/home/study/docs");
  });
});

describe("executeShellInput: 位置パラメータ", () => {
  it("argvを渡すと $1 $2 $# $@ で参照できる", () => {
    const context = buildContext();

    const result = executeShellInput('echo "$1" "$2" "$#" "$@"', context, ["a", "b c"]);

    expect(result.stdout).toBe("a b c 2 a b c\n");
  });
});

describe("executeShellInput: if/elif/else", () => {
  it("条件が真ならthen節を実行する", () => {
    const context = buildContext();
    const result = executeShellInput("if true; then echo yes; else echo no; fi", context);
    expect(result.stdout).toBe("yes\n");
    expect(result.exitCode).toBe(0);
  });

  it("条件が偽ならelse節を実行する", () => {
    const context = buildContext();
    const result = executeShellInput("if false; then echo yes; else echo no; fi", context);
    expect(result.stdout).toBe("no\n");
  });

  it("elifを順に評価する", () => {
    const context = buildContext();
    const result = executeShellInput(
      "if false; then echo a; elif false; then echo b; elif true; then echo c; else echo d; fi",
      context,
    );
    expect(result.stdout).toBe("c\n");
  });

  it("該当する分岐が無く else も無い場合は何も実行せず終了ステータス0になる", () => {
    const context = buildContext();
    const result = executeShellInput("if false; then echo a; fi", context);
    expect(result.stdout).toBe("");
    expect(result.exitCode).toBe(0);
  });

  it("test/[ コマンドの判定結果をif条件として使える", () => {
    const context = buildContext();
    const result = executeShellInput('if [ -f /home/study/file1.txt ]; then echo found; fi', context);
    expect(result.stdout).toBe("found\n");
  });
});

describe("executeShellInput: for", () => {
  it("単語リストを順に変数へ束縛して本体を実行する", () => {
    const context = buildContext();
    const result = executeShellInput("for f in a b c; do echo $f; done", context);
    expect(result.stdout).toBe("a\nb\nc\n");
  });

  it("in句を省略すると位置パラメータを反復する", () => {
    const context = buildContext();
    const result = executeShellInput("for f; do echo $f; done", context, ["x", "y"]);
    expect(result.stdout).toBe("x\ny\n");
  });

  it("ループ変数はループ終了後もセッションに残る(bashと同じ)", () => {
    const context = buildContext();
    executeShellInput("for f in a b c; do :; done", context);
    expect(context.env.f).toBe("c");
  });

  it("クォートされていない変数展開はIFSで単語分割され、複数回反復する", () => {
    const context = buildContext();
    const result = executeShellInput('LIST="a b c"; for f in $LIST; do echo $f; done', context);
    expect(result.stdout).toBe("a\nb\nc\n");
  });

  it("ダブルクォートされた変数展開は分割されず1回だけ反復する", () => {
    const context = buildContext();
    const result = executeShellInput('LIST="a b c"; for f in "$LIST"; do echo $f; done', context);
    expect(result.stdout).toBe("a b c\n");
  });

  it("IFSを変更すると、その文字を区切りとして単語分割する", () => {
    const context = buildContext();
    const result = executeShellInput(
      'IFS=:; LIST="a:b:c"; for f in $LIST; do echo $f; done',
      context,
    );
    expect(result.stdout).toBe("a\nb\nc\n");
  });

  it("コマンド置換の結果もIFSで単語分割される", () => {
    const context = buildContext();
    const result = executeShellInput("for f in $(echo a b c); do echo $f; done", context);
    expect(result.stdout).toBe("a\nb\nc\n");
  });
});

describe("executeShellInput: 単純コマンドの引数のIFS単語分割", () => {
  it("クォートされていない変数展開はコマンドの引数として複数に分割される", () => {
    const context = buildContext();
    const result = executeShellInput('count() { echo $#; }; LIST="a b c"; count $LIST', context);
    expect(result.stdout).toBe("3\n");
  });

  it("ダブルクォートすれば1つの引数のまま渡せる", () => {
    const context = buildContext();
    const result = executeShellInput('count() { echo $#; }; LIST="a b c"; count "$LIST"', context);
    expect(result.stdout).toBe("1\n");
  });
});

describe("executeShellInput: exit", () => {
  it("スクリプトの実行をその時点で打ち切り、指定した終了ステータスを返す", () => {
    const context = buildContext();
    const result = executeShellInput("echo before; exit 3; echo after", context);
    expect(result.stdout).toBe("before\n");
    expect(result.exitCode).toBe(3);
  });

  it("引数省略時は直前の終了ステータスを引き継ぐ", () => {
    const context = buildContext();
    const result = executeShellInput("cd /nope; exit", context);
    expect(result.exitCode).toBe(1);
  });

  it("関数の中から呼んでもreturnと違いスクリプト全体を終了させる", () => {
    const context = buildContext();
    const result = executeShellInput("f() { echo in-fn; exit 5; echo unreachable; }; f; echo also-unreachable", context);
    expect(result.stdout).toBe("in-fn\n");
    expect(result.exitCode).toBe(5);
  });

  it("ループ・if の中から呼んでもスクリプト全体を終了させる", () => {
    const context = buildContext();
    const result = executeShellInput(
      'for i in 1 2 3; do if [ "$i" = 2 ]; then exit 7; fi; echo $i; done; echo unreachable',
      context,
    );
    expect(result.stdout).toBe("1\n");
    expect(result.exitCode).toBe(7);
  });

  it("コマンド置換($(...))の中のexitはサブシェルのみを終了させ、親には伝播しない", () => {
    const context = buildContext();
    const result = executeShellInput('x=$(echo inner; exit 2); echo "got:$x"; echo after', context);
    expect(result.stdout).toBe("got:inner\nafter\n");
    expect(result.exitCode).toBe(0);
  });
});

describe("executeShellInput: while", () => {
  it("条件が真の間だけ本体を繰り返す", () => {
    const context = buildContext();
    const result = executeShellInput(
      'i=0; while [ "$i" -lt 3 ]; do echo $i; i=$((i + 1)); done',
      context,
    );
    expect(result.stdout).toBe("0\n1\n2\n");
    expect(context.env.i).toBe("3");
  });

  it("条件が最初から偽なら本体を実行しない", () => {
    const context = buildContext();
    const result = executeShellInput("while false; do echo unreachable; done", context);
    expect(result.stdout).toBe("");
  });
});

describe("executeShellInput: case", () => {
  it("最初にマッチしたパターンの本体だけを実行する", () => {
    const context = buildContext();
    const result = executeShellInput(
      'ans=yes; case "$ans" in y|yes) echo ok;; n|no) echo ng;; *) echo default;; esac',
      context,
    );
    expect(result.stdout).toBe("ok\n");
  });

  it("*でデフォルトにフォールバックする", () => {
    const context = buildContext();
    const result = executeShellInput('case "zzz" in y|yes) echo ok;; *) echo default;; esac', context);
    expect(result.stdout).toBe("default\n");
  });

  it("*等のグロブパターンでマッチする", () => {
    const context = buildContext();
    const result = executeShellInput('case "file.txt" in *.txt) echo text;; *) echo other;; esac', context);
    expect(result.stdout).toBe("text\n");
  });
});

describe("executeShellInput: シェル関数", () => {
  it("定義した関数を呼び出せる。$1などで引数を参照できる", () => {
    const context = buildContext();
    const result = executeShellInput('greet() { echo "hello $1"; }; greet world', context);
    expect(result.stdout).toBe("hello world\n");
  });

  it("returnで終了ステータスを返し、以降の文は実行しない", () => {
    const context = buildContext();
    const result = executeShellInput(
      "f() { echo before; return 3; echo after; }; f; echo \"code=$?\"",
      context,
    );
    expect(result.stdout).toBe("before\ncode=3\n");
  });

  it("localで宣言した変数は関数呼び出しの外に漏れない", () => {
    const context = buildContext();
    const result = executeShellInput(
      'x=outer; f() { local x=inner; echo $x; }; f; echo $x',
      context,
    );
    expect(result.stdout).toBe("inner\nouter\n");
  });

  it("再帰呼び出しで階乗を計算できる", () => {
    const context = buildContext();
    const result = executeShellInput(
      "fact() { if [ \"$1\" -le 1 ]; then echo 1; else " +
        'local n=$1; local rest=$(fact $(( n - 1 ))); echo $(( n * rest )); fi; }; fact 5',
      context,
    );
    expect(result.stdout).toBe("120\n");
  });

  it("関数はスクリプト内の後方の呼び出しからも参照できる(先に全文パースされるため)", () => {
    const context = buildContext();
    const result = executeShellInput("f() { echo hi; }; f; f", context);
    expect(result.stdout).toBe("hi\nhi\n");
  });
});
