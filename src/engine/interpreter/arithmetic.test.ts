import { describe, expect, it } from "vitest";

import { ShellRuntimeError } from "./errors";
import { evaluateArithmetic } from "./arithmetic";

describe("evaluateArithmetic", () => {
  it("四則演算・剰余を計算する", () => {
    expect(evaluateArithmetic("1 + 2", {})).toBe(3);
    expect(evaluateArithmetic("10 - 4", {})).toBe(6);
    expect(evaluateArithmetic("3 * 4", {})).toBe(12);
    expect(evaluateArithmetic("10 / 3", {})).toBe(3);
    expect(evaluateArithmetic("10 % 3", {})).toBe(1);
  });

  it("演算子の優先順位・丸括弧を考慮する", () => {
    expect(evaluateArithmetic("2 + 3 * 4", {})).toBe(14);
    expect(evaluateArithmetic("(2 + 3) * 4", {})).toBe(20);
  });

  it("単項マイナスに対応する", () => {
    expect(evaluateArithmetic("-5 + 3", {})).toBe(-2);
    expect(evaluateArithmetic("5 - -3", {})).toBe(8);
  });

  it("環境変数を数値として参照し、未設定時は0として扱う", () => {
    expect(evaluateArithmetic("X + 1", { X: "10" })).toBe(11);
    expect(evaluateArithmetic("UNSET + 1", {})).toBe(1);
  });

  it("0除算はエラーになる", () => {
    expect(() => evaluateArithmetic("1 / 0", {})).toThrow(ShellRuntimeError);
    expect(() => evaluateArithmetic("1 % 0", {})).toThrow(ShellRuntimeError);
  });

  it("不正な式はエラーになる", () => {
    expect(() => evaluateArithmetic("1 +", {})).toThrow(ShellRuntimeError);
    expect(() => evaluateArithmetic("(1 + 2", {})).toThrow(ShellRuntimeError);
    expect(() => evaluateArithmetic("1 2", {})).toThrow(ShellRuntimeError);
  });
});
