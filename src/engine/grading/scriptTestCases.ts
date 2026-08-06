import { gradeExercise } from "./grade";
import type { GradeInput, GradeResult } from "./types";

/**
 * スクリプト作成モード(docs/requirements.md 3章8節)の1テストケース。
 * 引数(`args`)・標準入力(`stdin`)の組み合わせを変えて同じスクリプトを複数パターン実行できるようにする。
 */
export interface ScriptTestCase {
  id: string;
  /** テストケース結果パネルに表示する説明文(例: "引数なし・標準入力2行")。 */
  description?: string;
  /** スクリプトに渡す位置パラメータ(`$1` `$@` 等)。省略時は空配列。 */
  args?: string[];
  /** スクリプトの標準入力。省略時は空文字列。 */
  stdin?: string;
}

export interface ScriptTestCaseResult {
  testCase: ScriptTestCase;
  grade: GradeResult;
}

/**
 * スクリプト全体を1つの`GradeInput`(`userInput`/`referenceSolution`等)として受け取り、
 * `testCases`それぞれの引数・標準入力の組み合わせで学習者のスクリプトと模範解答を実行・比較する。
 * 判定ロジック自体は`gradeExercise`(1回分の採点エンジン)へ委譲し、ここではテストケースの反復のみを担う。
 */
export function gradeScriptTestCases(
  input: Omit<GradeInput, "argv" | "stdin">,
  testCases: ScriptTestCase[],
): ScriptTestCaseResult[] {
  return testCases.map((testCase) => ({
    testCase,
    grade: gradeExercise({
      ...input,
      argv: testCase.args ?? [],
      stdin: testCase.stdin ?? "",
    }),
  }));
}
