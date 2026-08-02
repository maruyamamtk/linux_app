// 算術展開 `$((expr))` の評価器。
// 対応演算: 加減乗除・剰余、単項+-、丸括弧、変数参照(未設定・非数値は0として扱う)。
// 比較演算子・インクリメント演算子・三項演算子等は要件範囲外(Ch11-14で使う式は四則演算で十分なため)。
import { ShellRuntimeError } from "./errors";

class ArithmeticParser {
  private pos = 0;

  constructor(
    private readonly input: string,
    private readonly env: Record<string, string>,
  ) {}

  private skipSpaces(): void {
    while (this.input[this.pos] === " " || this.input[this.pos] === "\t") this.pos += 1;
  }

  private peek(): string | undefined {
    this.skipSpaces();
    return this.input[this.pos];
  }

  parseExpression(): number {
    let value = this.parseMultiplicative();
    for (;;) {
      const ch = this.peek();
      if (ch !== "+" && ch !== "-") break;
      this.pos += 1;
      const rhs = this.parseMultiplicative();
      value = ch === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  private parseMultiplicative(): number {
    let value = this.parseUnary();
    for (;;) {
      const ch = this.peek();
      if (ch !== "*" && ch !== "/" && ch !== "%") break;
      this.pos += 1;
      const rhs = this.parseUnary();
      if ((ch === "/" || ch === "%") && rhs === 0) {
        throw new ShellRuntimeError(`${this.input}: division by 0`);
      }
      value = ch === "*" ? value * rhs : ch === "/" ? Math.trunc(value / rhs) : value % rhs;
    }
    return value;
  }

  private parseUnary(): number {
    const ch = this.peek();
    if (ch === "+" || ch === "-") {
      this.pos += 1;
      const value = this.parseUnary();
      return ch === "-" ? -value : value;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const ch = this.peek();
    if (ch === "(") {
      this.pos += 1;
      const value = this.parseExpression();
      this.skipSpaces();
      if (this.input[this.pos] !== ")") {
        throw new ShellRuntimeError(`${this.input}: syntax error in expression`);
      }
      this.pos += 1;
      return value;
    }
    if (ch !== undefined && /[0-9]/.test(ch)) {
      const start = this.pos;
      while (/[0-9]/.test(this.input[this.pos] ?? "")) this.pos += 1;
      return Number(this.input.slice(start, this.pos));
    }
    if (ch !== undefined && /[A-Za-z_]/.test(ch)) {
      const start = this.pos;
      while (/[A-Za-z0-9_]/.test(this.input[this.pos] ?? "")) this.pos += 1;
      const name = this.input.slice(start, this.pos);
      const raw = this.env[name];
      const value = raw !== undefined ? Number(raw) : 0;
      return Number.isFinite(value) ? value : 0;
    }
    throw new ShellRuntimeError(`${this.input}: syntax error in expression`);
  }

  expectEnd(): void {
    this.skipSpaces();
    if (this.pos !== this.input.length) {
      throw new ShellRuntimeError(`${this.input}: syntax error in expression`);
    }
  }
}

export function evaluateArithmetic(expression: string, env: Record<string, string>): number {
  const parser = new ArithmeticParser(expression, env);
  const value = parser.parseExpression();
  parser.expectEnd();
  return value;
}
