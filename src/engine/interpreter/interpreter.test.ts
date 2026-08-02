import { describe, expect, it } from "vitest";

import { buildContext } from "../commands/testFixtures";
import type { CommandContext } from "../commands";
import { parseScript } from "../shell";
import type { SimpleCommand } from "../shell";
import { executeShellInput } from "./interpreter";
import { resolveRedirects } from "./redirect";
import type { ShellState } from "./types";

function firstCommand(input: string): SimpleCommand {
  return parseScript(input).body[0].andOr.pipelines[0].commands[0];
}

function buildState(context: CommandContext): ShellState {
  return {
    context,
    lastExitCode: 0,
    runSubshell: () => {
      throw new Error("not used in these tests");
    },
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
