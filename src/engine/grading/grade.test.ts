import { describe, expect, it } from "vitest";

import { buildProcesses, buildSnapshot, STUDY_USER } from "../commands/testFixtures";
import type { GradeInput } from "./types";
import { gradeExercise } from "./grade";

function buildInput(overrides: Partial<GradeInput>): GradeInput {
  return {
    snapshot: buildSnapshot(),
    user: STUDY_USER,
    cwd: "/home/study",
    env: { HOME: "/home/study", PATH: "/bin:/usr/bin" },
    processes: buildProcesses(),
    userInput: "",
    referenceSolution: "",
    ...overrides,
  };
}

describe("gradeExercise", () => {
  it("模範解答と全く同じコマンドは正解と判定される", () => {
    const result = gradeExercise(buildInput({ userInput: "pwd", referenceSolution: "pwd" }));

    expect(result.passed).toBe(true);
    expect(result.stdout.match).toBe(true);
    expect(result.vfsMismatches).toEqual([]);
  });

  it("書き方が違っても観測可能な効果が同じ別解は正解になる(リダイレクトによる空ファイル作成 vs touch)", () => {
    const result = gradeExercise(
      buildInput({ userInput: "> newfile.txt", referenceSolution: "touch newfile.txt" }),
    );

    expect(result.passed).toBe(true);
    expect(result.vfsMismatches).toEqual([]);
  });

  it("出力の行順序だけが違う場合、デフォルトモードでは不正解になる", () => {
    const result = gradeExercise(
      buildInput({ userInput: "echo b; echo a", referenceSolution: "echo a; echo b" }),
    );

    expect(result.passed).toBe(false);
    expect(result.stdout.match).toBe(false);
  });

  it("出力の行順序だけが違う場合、ignoreLineOrderモードでは正解になる", () => {
    const result = gradeExercise(
      buildInput({
        userInput: "echo b; echo a",
        referenceSolution: "echo a; echo b",
        options: { stdoutMode: "ignoreLineOrder" },
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.stdout.match).toBe(true);
  });

  it("実行後のファイル内容が模範解答と異なる場合、不正解となりVFS差分に対象パスが含まれる", () => {
    const result = gradeExercise(
      buildInput({ userInput: "echo hi > out.txt", referenceSolution: "echo hello > out.txt" }),
    );

    expect(result.passed).toBe(false);
    expect(result.vfsMismatches).toEqual([
      expect.objectContaining({ path: "/home/study/out.txt", change: "modified" }),
    ]);
  });

  it("パーミッションの違いも実行後のVFS比較で検出される", () => {
    const result = gradeExercise(
      buildInput({ userInput: "true", referenceSolution: "chmod 600 file1.txt" }),
    );

    expect(result.passed).toBe(false);
    expect(result.vfsMismatches).toEqual([
      expect.objectContaining({ path: "/home/study/file1.txt", change: "modified" }),
    ]);
  });

  it("ignoreVfsPathsで指定したパス配下の差分は判定から除外される", () => {
    const withoutIgnore = gradeExercise(
      buildInput({ userInput: "touch scratch.log", referenceSolution: "true" }),
    );
    expect(withoutIgnore.passed).toBe(false);

    const withIgnore = gradeExercise(
      buildInput({
        userInput: "touch scratch.log",
        referenceSolution: "true",
        options: { ignoreVfsPaths: ["/home/study/scratch.log"] },
      }),
    );
    expect(withIgnore.passed).toBe(true);
    expect(withIgnore.vfsMismatches).toEqual([]);
  });

  it("終了ステータスの違いはデフォルトで不正解と判定され、compareExitCode:falseで無視できる", () => {
    const withExitCode = gradeExercise(buildInput({ userInput: "false", referenceSolution: "true" }));
    expect(withExitCode.passed).toBe(false);
    expect(withExitCode.exitCode).toEqual({ match: false, expected: 0, actual: 1 });

    const withoutExitCode = gradeExercise(
      buildInput({
        userInput: "false",
        referenceSolution: "true",
        options: { compareExitCode: false },
      }),
    );
    expect(withoutExitCode.passed).toBe(true);
  });

  it("compareVfs:falseの場合はVFS状態の差分を判定に含めない", () => {
    const result = gradeExercise(
      buildInput({
        userInput: "true",
        referenceSolution: "chmod 600 file1.txt",
        options: { compareVfs: false },
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.vfsMismatches).toEqual([]);
  });

  it("学習者と模範解答は独立したVFS上で実行されるため、互いの副作用が漏れない", () => {
    const result = gradeExercise(
      buildInput({ userInput: "echo user > shared.txt", referenceSolution: "echo ref > shared.txt" }),
    );

    expect(result.userResult.stdout).toBe("");
    expect(result.referenceResult.stdout).toBe("");
    expect(result.passed).toBe(false);
  });

  it("argvは学習者・模範解答双方の位置パラメータ($1等)として渡される(スクリプト作成モード向け)", () => {
    const result = gradeExercise(
      buildInput({
        userInput: 'echo "Hello, $1!"',
        referenceSolution: 'echo "Hello, $1!"',
        argv: ["Alice"],
      }),
    );

    expect(result.userResult.stdout).toBe("Hello, Alice!\n");
    expect(result.passed).toBe(true);
  });

  it("stdinは学習者・模範解答双方の標準入力として渡される(スクリプト作成モード向け)", () => {
    const result = gradeExercise(
      buildInput({ userInput: "wc -l", referenceSolution: "wc -l", stdin: "a\nb\nc\n" }),
    );

    expect(result.userResult.stdout.trim()).toBe("3");
    expect(result.passed).toBe(true);
  });

  it("argv/stdinが異なれば同じスクリプトでも別解ではなく不正解として検出できる", () => {
    const result = gradeExercise(
      buildInput({
        userInput: 'echo "Hi, $1"',
        referenceSolution: 'echo "Hello, $1!"',
        argv: ["Bob"],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.stdout.expected).toBe("Hello, Bob!\n");
    expect(result.stdout.actual).toBe("Hi, Bob\n");
  });
});
