import { describe, expect, it } from "vitest";

import { buildProcesses, buildSnapshot, STUDY_USER } from "../commands/testFixtures";
import { gradeScriptTestCases } from "./scriptTestCases";
import type { GradeInput } from "./types";

/** `wc`の出力は各カウントを7桁固定幅で左パディングするため、比較しやすいよう行ごとに前後の空白を除く。 */
function normalizeWcOutput(stdout: string): string {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .join("\n");
}

function buildBaseInput(overrides: Partial<Omit<GradeInput, "argv" | "stdin">> = {}) {
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

describe("gradeScriptTestCases", () => {
  it("テストケースごとに引数・標準入力を切り替えてスクリプトを実行し、それぞれ判定結果を返す", () => {
    const script = 'echo "Hello, $1!"; wc -l';
    const results = gradeScriptTestCases(
      buildBaseInput({ userInput: script, referenceSolution: script }),
      [
        { id: "tc1", description: "Alice・2行", args: ["Alice"], stdin: "a\nb\n" },
        { id: "tc2", description: "Bob・入力なし", args: ["Bob"] },
      ],
    );

    expect(results).toHaveLength(2);
    expect(results[0].testCase.id).toBe("tc1");
    expect(results[0].grade.passed).toBe(true);
    expect(normalizeWcOutput(results[0].grade.userResult.stdout)).toBe("Hello, Alice!\n2\n");
    expect(results[1].grade.passed).toBe(true);
    expect(normalizeWcOutput(results[1].grade.userResult.stdout)).toBe("Hello, Bob!\n0\n");
  });

  it("学習者のスクリプトが一部のテストケースでのみ模範解答と異なる出力になる場合、そのケースだけ不正解になる", () => {
    const results = gradeScriptTestCases(
      buildBaseInput({
        userInput: 'if [ "$1" = "special" ]; then echo wrong; else echo "Hi, $1"; fi',
        referenceSolution: 'echo "Hi, $1"',
      }),
      [
        { id: "normal", args: ["taro"] },
        { id: "special", args: ["special"] },
      ],
    );

    expect(results[0].grade.passed).toBe(true);
    expect(results[1].grade.passed).toBe(false);
  });

  it("テストケースが空配列の場合は結果も空配列になる", () => {
    const results = gradeScriptTestCases(
      buildBaseInput({ userInput: "true", referenceSolution: "true" }),
      [],
    );

    expect(results).toEqual([]);
  });
});
