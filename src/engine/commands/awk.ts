import { normalizePath } from "../vfs";
import { describeVfsError, fail, ok } from "./errors";
import type { CommandHandler } from "./types";

type AwkValue = string | number;

type AwkExpr =
  | { type: "Number"; value: number }
  | { type: "String"; value: string }
  | { type: "Regex"; value: RegExp }
  | { type: "Field"; index: AwkExpr }
  | { type: "Ident"; name: string }
  | { type: "Assign"; op: "=" | "+=" | "-=" | "*=" | "/="; name: string; value: AwkExpr }
  | { type: "Binary"; op: string; left: AwkExpr; right: AwkExpr }
  | { type: "Unary"; op: "-" | "+" | "!"; operand: AwkExpr }
  | { type: "Concat"; parts: AwkExpr[] };

type AwkStatement = { type: "Print"; args: AwkExpr[] } | { type: "ExprStatement"; expr: AwkExpr };

interface AwkRule {
  kind: "begin" | "end" | "main";
  pattern?: AwkExpr;
  action?: AwkStatement[];
}

interface ParserState {
  src: string;
  pos: number;
}

/** 行内空白(スペース・タブ)と `#` コメントのみをスキップする。改行は文区切りとして扱うため消費しない。 */
function skipInline(state: ParserState): void {
  while (state.pos < state.src.length) {
    const ch = state.src[state.pos];
    if (ch === " " || ch === "\t") {
      state.pos += 1;
      continue;
    }
    if (ch === "#") {
      while (state.pos < state.src.length && state.src[state.pos] !== "\n") state.pos += 1;
      continue;
    }
    break;
  }
}

/** 文/ルールの区切り(空白・改行・`;`)をまとめてスキップする。 */
function skipSeparators(state: ParserState): void {
  while (state.pos < state.src.length) {
    const ch = state.src[state.pos];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === ";") {
      state.pos += 1;
      continue;
    }
    if (ch === "#") {
      while (state.pos < state.src.length && state.src[state.pos] !== "\n") state.pos += 1;
      continue;
    }
    break;
  }
}

function matchKeyword(state: ParserState, word: string): boolean {
  skipInline(state);
  if (!state.src.startsWith(word, state.pos)) return false;
  const after = state.src[state.pos + word.length];
  if (after !== undefined && /[A-Za-z0-9_]/.test(after)) return false;
  state.pos += word.length;
  return true;
}

function expectChar(state: ParserState, ch: string): void {
  skipInline(state);
  if (state.src[state.pos] !== ch) {
    throw new Error(`expected '${ch}' but got '${state.src[state.pos] ?? "EOF"}'`);
  }
  state.pos += 1;
}

function readIdent(state: ParserState): string {
  const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(state.src.slice(state.pos));
  if (!match) throw new Error("expected identifier");
  state.pos += match[0].length;
  return match[0];
}

function parseNumberLiteral(state: ParserState): AwkExpr {
  const match = /^\d+(\.\d+)?([eE][+-]?\d+)?/.exec(state.src.slice(state.pos));
  if (!match) throw new Error("expected number");
  state.pos += match[0].length;
  return { type: "Number", value: Number(match[0]) };
}

function parseStringLiteral(state: ParserState): AwkExpr {
  state.pos += 1; // opening quote
  let value = "";
  while (state.pos < state.src.length && state.src[state.pos] !== '"') {
    const ch = state.src[state.pos];
    if (ch === "\\" && state.pos + 1 < state.src.length) {
      const next = state.src[state.pos + 1];
      if (next === "n") value += "\n";
      else if (next === "t") value += "\t";
      else if (next === "\\") value += "\\";
      else if (next === '"') value += '"';
      else value += next;
      state.pos += 2;
      continue;
    }
    value += ch;
    state.pos += 1;
  }
  if (state.src[state.pos] !== '"') throw new Error("unterminated string literal");
  state.pos += 1;
  return { type: "String", value };
}

function parseRegexLiteral(state: ParserState): AwkExpr {
  state.pos += 1; // opening '/'
  let pattern = "";
  while (state.pos < state.src.length && state.src[state.pos] !== "/") {
    const ch = state.src[state.pos];
    if (ch === "\\" && state.pos + 1 < state.src.length) {
      const next = state.src[state.pos + 1];
      pattern += next === "/" ? "/" : ch + next;
      state.pos += 2;
      continue;
    }
    pattern += ch;
    state.pos += 1;
  }
  if (state.src[state.pos] !== "/") throw new Error("unterminated regex literal");
  state.pos += 1;
  return { type: "Regex", value: new RegExp(pattern) };
}

function parsePrimary(state: ParserState): AwkExpr {
  skipInline(state);
  const ch = state.src[state.pos];
  if (ch === undefined) throw new Error("unexpected end of program");
  if (ch === "(") {
    state.pos += 1;
    const expr = parseExpression(state);
    skipInline(state);
    expectChar(state, ")");
    return expr;
  }
  if (ch === "$") {
    state.pos += 1;
    return { type: "Field", index: parsePrimary(state) };
  }
  if (ch === "/") return parseRegexLiteral(state);
  if (ch === '"') return parseStringLiteral(state);
  if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(state.src[state.pos + 1] ?? ""))) {
    return parseNumberLiteral(state);
  }
  if (/[A-Za-z_]/.test(ch)) {
    return { type: "Ident", name: readIdent(state) };
  }
  throw new Error(`unexpected character '${ch}'`);
}

function parseUnary(state: ParserState): AwkExpr {
  skipInline(state);
  const ch = state.src[state.pos];
  if (ch === "!" || ch === "-" || ch === "+") {
    state.pos += 1;
    return { type: "Unary", op: ch, operand: parseUnary(state) };
  }
  return parsePrimary(state);
}

function parseMultiplicative(state: ParserState): AwkExpr {
  let left = parseUnary(state);
  while (true) {
    skipInline(state);
    const ch = state.src[state.pos];
    if (ch === "*" || ch === "/" || ch === "%") {
      state.pos += 1;
      left = { type: "Binary", op: ch, left, right: parseUnary(state) };
      continue;
    }
    break;
  }
  return left;
}

function parseAdditive(state: ParserState): AwkExpr {
  let left = parseMultiplicative(state);
  while (true) {
    skipInline(state);
    const ch = state.src[state.pos];
    if (ch === "+" || ch === "-") {
      state.pos += 1;
      left = { type: "Binary", op: ch, left, right: parseMultiplicative(state) };
      continue;
    }
    break;
  }
  return left;
}

function startsPrimary(ch: string | undefined): boolean {
  if (ch === undefined) return false;
  return ch === "$" || ch === '"' || ch === "/" || ch === "(" || /[0-9A-Za-z_.]/.test(ch);
}

/** 演算子を挟まず式が連続する場合は文字列連結(concatenation)として扱う。 */
function parseConcat(state: ParserState): AwkExpr {
  const first = parseAdditive(state);
  const parts = [first];
  while (true) {
    skipInline(state);
    if (startsPrimary(state.src[state.pos])) {
      parts.push(parseAdditive(state));
      continue;
    }
    break;
  }
  return parts.length === 1 ? parts[0] : { type: "Concat", parts };
}

function parseRelational(state: ParserState): AwkExpr {
  let left = parseConcat(state);
  while (true) {
    skipInline(state);
    const two = state.src.slice(state.pos, state.pos + 2);
    if (two === "==" || two === "!=" || two === "<=" || two === ">=" || two === "!~") {
      state.pos += 2;
      left = { type: "Binary", op: two, left, right: parseConcat(state) };
      continue;
    }
    const one = state.src[state.pos];
    if (one === "<" || one === ">" || one === "~") {
      state.pos += 1;
      left = { type: "Binary", op: one, left, right: parseConcat(state) };
      continue;
    }
    break;
  }
  return left;
}

function parseAnd(state: ParserState): AwkExpr {
  let left = parseRelational(state);
  while (true) {
    skipInline(state);
    if (state.src.slice(state.pos, state.pos + 2) === "&&") {
      state.pos += 2;
      left = { type: "Binary", op: "&&", left, right: parseRelational(state) };
      continue;
    }
    break;
  }
  return left;
}

function parseOr(state: ParserState): AwkExpr {
  let left = parseAnd(state);
  while (true) {
    skipInline(state);
    if (state.src.slice(state.pos, state.pos + 2) === "||") {
      state.pos += 2;
      left = { type: "Binary", op: "||", left, right: parseAnd(state) };
      continue;
    }
    break;
  }
  return left;
}

function parseExpression(state: ParserState): AwkExpr {
  return parseOr(state);
}

function matchAssignOp(state: ParserState): "=" | "+=" | "-=" | "*=" | "/=" | undefined {
  skipInline(state);
  const two = state.src.slice(state.pos, state.pos + 2);
  if (two === "+=" || two === "-=" || two === "*=" || two === "/=") {
    state.pos += 2;
    return two as "+=" | "-=" | "*=" | "/=";
  }
  if (state.src[state.pos] === "=" && state.src[state.pos + 1] !== "=") {
    state.pos += 1;
    return "=";
  }
  return undefined;
}

function isStatementEnd(state: ParserState): boolean {
  skipInline(state);
  const ch = state.src[state.pos];
  return ch === undefined || ch === ";" || ch === "\n" || ch === "}";
}

function parseStatement(state: ParserState): AwkStatement {
  skipInline(state);
  if (matchKeyword(state, "print")) {
    const args: AwkExpr[] = [];
    if (!isStatementEnd(state)) {
      args.push(parseExpression(state));
      while (true) {
        skipInline(state);
        if (state.src[state.pos] === ",") {
          state.pos += 1;
          args.push(parseExpression(state));
          continue;
        }
        break;
      }
    }
    return { type: "Print", args };
  }

  const savedPos = state.pos;
  if (/[A-Za-z_]/.test(state.src[state.pos] ?? "")) {
    const name = readIdent(state);
    const op = matchAssignOp(state);
    if (op) {
      const value = parseExpression(state);
      return { type: "ExprStatement", expr: { type: "Assign", op, name, value } };
    }
  }
  state.pos = savedPos;
  return { type: "ExprStatement", expr: parseExpression(state) };
}

function parseStatementList(state: ParserState): AwkStatement[] {
  const statements: AwkStatement[] = [];
  skipSeparators(state);
  while (state.pos < state.src.length && state.src[state.pos] !== "}") {
    statements.push(parseStatement(state));
    skipSeparators(state);
  }
  return statements;
}

function parseBlock(state: ParserState): AwkStatement[] {
  skipSeparators(state);
  expectChar(state, "{");
  const statements = parseStatementList(state);
  expectChar(state, "}");
  return statements;
}

/** `BEGIN{...}` `END{...}` `パターン{アクション}` からなるawkプログラム全体を解析する。 */
export function parseAwkProgram(script: string): AwkRule[] {
  const state: ParserState = { src: script, pos: 0 };
  const rules: AwkRule[] = [];

  skipSeparators(state);
  while (state.pos < state.src.length) {
    if (matchKeyword(state, "BEGIN")) {
      rules.push({ kind: "begin", action: parseBlock(state) });
    } else if (matchKeyword(state, "END")) {
      rules.push({ kind: "end", action: parseBlock(state) });
    } else {
      skipInline(state);
      if (state.src[state.pos] === "{") {
        rules.push({ kind: "main", action: parseBlock(state) });
      } else {
        const pattern = parseExpression(state);
        skipInline(state);
        const action = state.src[state.pos] === "{" ? parseBlock(state) : undefined;
        rules.push({ kind: "main", pattern, action });
      }
    }
    skipSeparators(state);
  }

  return rules;
}

interface AwkRuntime {
  fields: string[];
  vars: Map<string, AwkValue>;
  nr: number;
  fs: string;
  ofs: string;
}

function toNumber(value: AwkValue): number {
  if (typeof value === "number") return value;
  const match = /^\s*[+-]?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(value);
  if (!match) return 0;
  const n = Number(match[0]);
  return Number.isNaN(n) ? 0 : n;
}

function toStr(value: AwkValue): string {
  return typeof value === "string" ? value : String(value);
}

function isNumericLiteralString(value: string): boolean {
  return /^\s*[+-]?\d+(\.\d+)?([eE][+-]?\d+)?\s*$/.test(value);
}

function toBool(value: AwkValue): boolean {
  if (typeof value === "number") return value !== 0;
  if (isNumericLiteralString(value)) return toNumber(value) !== 0;
  return value !== "";
}

function bothNumeric(a: AwkValue, b: AwkValue): boolean {
  const aNum = typeof a === "number" || isNumericLiteralString(a);
  const bNum = typeof b === "number" || isNumericLiteralString(b);
  return aNum && bNum;
}

function compareValues(op: string, left: AwkValue, right: AwkValue): boolean {
  if (bothNumeric(left, right)) {
    const l = toNumber(left);
    const r = toNumber(right);
    switch (op) {
      case "==":
        return l === r;
      case "!=":
        return l !== r;
      case "<":
        return l < r;
      case "<=":
        return l <= r;
      case ">":
        return l > r;
      case ">=":
        return l >= r;
      default:
        throw new Error(`unknown operator ${op}`);
    }
  }
  const l = toStr(left);
  const r = toStr(right);
  switch (op) {
    case "==":
      return l === r;
    case "!=":
      return l !== r;
    case "<":
      return l < r;
    case "<=":
      return l <= r;
    case ">":
      return l > r;
    case ">=":
      return l >= r;
    default:
      throw new Error(`unknown operator ${op}`);
  }
}

function getField(runtime: AwkRuntime, index: number): string {
  return runtime.fields[index] ?? "";
}

function getVar(runtime: AwkRuntime, name: string): AwkValue {
  if (name === "NR") return runtime.nr;
  if (name === "NF") return runtime.fields.length - 1;
  if (name === "FS") return runtime.fs;
  if (name === "OFS") return runtime.ofs;
  return runtime.vars.get(name) ?? "";
}

function setVar(runtime: AwkRuntime, name: string, value: AwkValue): void {
  if (name === "FS") {
    runtime.fs = toStr(value);
    return;
  }
  if (name === "OFS") {
    runtime.ofs = toStr(value);
    return;
  }
  runtime.vars.set(name, value);
}

function evaluate(expr: AwkExpr, runtime: AwkRuntime): AwkValue {
  switch (expr.type) {
    case "Number":
      return expr.value;
    case "String":
      return expr.value;
    case "Regex":
      return expr.value.test(getField(runtime, 0)) ? 1 : 0;
    case "Field": {
      const index = Math.trunc(toNumber(evaluate(expr.index, runtime)));
      return getField(runtime, index);
    }
    case "Ident":
      return getVar(runtime, expr.name);
    case "Assign": {
      const rhs = evaluate(expr.value, runtime);
      let result: AwkValue;
      if (expr.op === "=") {
        result = rhs;
      } else {
        const base = toNumber(getVar(runtime, expr.name));
        const delta = toNumber(rhs);
        result =
          expr.op === "+="
            ? base + delta
            : expr.op === "-="
              ? base - delta
              : expr.op === "*="
                ? base * delta
                : base / delta;
      }
      setVar(runtime, expr.name, result);
      return result;
    }
    case "Unary": {
      const value = evaluate(expr.operand, runtime);
      if (expr.op === "!") return toBool(value) ? 0 : 1;
      if (expr.op === "-") return -toNumber(value);
      return toNumber(value);
    }
    case "Concat":
      return expr.parts.map((part) => toStr(evaluate(part, runtime))).join("");
    case "Binary": {
      if (expr.op === "&&") {
        return toBool(evaluate(expr.left, runtime)) && toBool(evaluate(expr.right, runtime)) ? 1 : 0;
      }
      if (expr.op === "||") {
        return toBool(evaluate(expr.left, runtime)) || toBool(evaluate(expr.right, runtime)) ? 1 : 0;
      }
      if (expr.op === "~" || expr.op === "!~") {
        const left = toStr(evaluate(expr.left, runtime));
        const regex = expr.right.type === "Regex" ? expr.right.value : new RegExp(toStr(evaluate(expr.right, runtime)));
        const matched = regex.test(left);
        return (expr.op === "~" ? matched : !matched) ? 1 : 0;
      }
      if (expr.op === "==" || expr.op === "!=" || expr.op === "<" || expr.op === "<=" || expr.op === ">" || expr.op === ">=") {
        return compareValues(expr.op, evaluate(expr.left, runtime), evaluate(expr.right, runtime)) ? 1 : 0;
      }
      const left = toNumber(evaluate(expr.left, runtime));
      const right = toNumber(evaluate(expr.right, runtime));
      switch (expr.op) {
        case "+":
          return left + right;
        case "-":
          return left - right;
        case "*":
          return left * right;
        case "/":
          return left / right;
        case "%":
          return left % right;
        default:
          throw new Error(`unknown operator ${expr.op}`);
      }
    }
    default:
      throw new Error("unknown expression node");
  }
}

function execStatement(statement: AwkStatement, runtime: AwkRuntime, emit: (line: string) => void): void {
  if (statement.type === "Print") {
    if (statement.args.length === 0) {
      emit(getField(runtime, 0));
      return;
    }
    emit(statement.args.map((arg) => toStr(evaluate(arg, runtime))).join(runtime.ofs));
    return;
  }
  evaluate(statement.expr, runtime);
}

function splitFields(line: string, fs: string): string[] {
  if (fs === " ") {
    const trimmed = line.trim();
    return trimmed.length === 0 ? [] : trimmed.split(/\s+/);
  }
  if (fs.length === 1) return line.split(fs);
  return line.split(new RegExp(fs));
}

function matchesPattern(rule: AwkRule, runtime: AwkRuntime): boolean {
  if (!rule.pattern) return true;
  return toBool(evaluate(rule.pattern, runtime));
}

export function runAwk(rules: AwkRule[], lines: string[], fieldSeparator: string): string {
  const runtime: AwkRuntime = { fields: [""], vars: new Map(), nr: 0, fs: fieldSeparator, ofs: " " };
  const outputLines: string[] = [];
  const emit = (line: string): void => {
    outputLines.push(line);
  };

  for (const rule of rules) {
    if (rule.kind === "begin") for (const statement of rule.action ?? []) execStatement(statement, runtime, emit);
  }

  for (const line of lines) {
    runtime.nr += 1;
    runtime.fields = [line, ...splitFields(line, runtime.fs)];
    for (const rule of rules) {
      if (rule.kind !== "main") continue;
      if (!matchesPattern(rule, runtime)) continue;
      const action = rule.action ?? [{ type: "Print", args: [] } as AwkStatement];
      for (const statement of action) execStatement(statement, runtime, emit);
    }
  }

  for (const rule of rules) {
    if (rule.kind === "end") for (const statement of rule.action ?? []) execStatement(statement, runtime, emit);
  }

  return outputLines.length > 0 ? `${outputLines.join("\n")}\n` : "";
}

interface AwkInvocation {
  fieldSeparator: string;
  scriptParts: string[];
  files: string[];
}

function parseAwkInvocation(args: string[]): AwkInvocation {
  let fieldSeparator = " ";
  const scriptParts: string[] = [];
  const files: string[] = [];
  let sawScript = false;
  let i = 0;

  while (i < args.length) {
    const arg = args[i];
    if (arg === "-F") {
      fieldSeparator = args[i + 1] ?? " ";
      i += 2;
      continue;
    }
    if (arg.startsWith("-F") && arg.length > 2) {
      fieldSeparator = arg.slice(2);
      i += 1;
      continue;
    }
    if (!sawScript) {
      scriptParts.push(arg);
      sawScript = true;
      i += 1;
      continue;
    }
    files.push(arg);
    i += 1;
  }

  return { fieldSeparator, scriptParts, files };
}

export const awkCommand: CommandHandler = (args, context) => {
  const { fieldSeparator, scriptParts, files } = parseAwkInvocation(args);
  if (scriptParts.length === 0) return fail("awk: missing program text");
  if (files.length === 0) return fail("awk: missing file operand");

  let rules: AwkRule[];
  try {
    rules = parseAwkProgram(scriptParts.join("\n"));
  } catch (error) {
    return fail(`awk: syntax error: ${error instanceof Error ? error.message : String(error)}`);
  }

  const contents: string[] = [];
  for (const file of files) {
    const resolved = normalizePath(file, context.cwd);
    try {
      if (context.vfs.stat(resolved).type === "directory") {
        return fail(`awk: ${file}: Is a directory`);
      }
      contents.push(context.vfs.readFile(resolved));
    } catch (error) {
      return fail(describeVfsError("awk", file, error, "can't open"));
    }
  }

  const combined = contents.join("");
  const withoutTrailingNewline = combined.endsWith("\n") ? combined.slice(0, -1) : combined;
  const lines = combined.length === 0 ? [] : withoutTrailingNewline.split("\n");

  try {
    return ok(runAwk(rules, lines, fieldSeparator));
  } catch (error) {
    return fail(`awk: ${error instanceof Error ? error.message : String(error)}`);
  }
};
