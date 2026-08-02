// `test` / `[` 組み込みコマンド。シェルの制御構造(if/while)の条件判定で使う基本的な
// 単項・二項の判定式に対応する(`-a`/`-o`によるテスト式の結合、`[[ ]]` 独自の演算子は対象外)。
import { normalizePath, type VfsStat } from "../vfs";
import { fail } from "./errors";
import type { CommandContext, CommandHandler, CommandResult } from "./types";

class TestSyntaxError extends Error {}

function statOrUndefined(context: CommandContext, path: string): VfsStat | undefined {
  const resolved = normalizePath(path, context.cwd);
  return context.vfs.exists(resolved) ? context.vfs.stat(resolved) : undefined;
}

function hasAccess(context: CommandContext, stat: VfsStat, bit: 0b100 | 0b010 | 0b001): boolean {
  const user = context.vfs.getUser();
  if (user.isRoot) return true;
  if (stat.owner === user.name) return ((stat.mode >> 6) & bit) === bit;
  if (user.groups.includes(stat.group)) return ((stat.mode >> 3) & bit) === bit;
  return (stat.mode & bit) === bit;
}

function evalFileUnary(op: string, operand: string, context: CommandContext): boolean {
  const stat = statOrUndefined(context, operand);
  switch (op) {
    case "-e":
      return stat !== undefined;
    case "-f":
      return stat?.type === "file";
    case "-d":
      return stat?.type === "directory";
    case "-s":
      return stat !== undefined && stat.size > 0;
    case "-r":
      return stat !== undefined && hasAccess(context, stat, 0b100);
    case "-w":
      return stat !== undefined && hasAccess(context, stat, 0b010);
    case "-x":
      return stat !== undefined && hasAccess(context, stat, 0b001);
    default:
      throw new TestSyntaxError(`unknown unary operator '${op}'`);
  }
}

function toInteger(operand: string): number {
  const value = Number(operand);
  if (!Number.isFinite(value) || !/^\s*-?[0-9]+\s*$/.test(operand)) {
    throw new TestSyntaxError(`integer expression expected: '${operand}'`);
  }
  return value;
}

function evalBinary(left: string, op: string, right: string, context: CommandContext): boolean {
  switch (op) {
    case "=":
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    case "-eq":
      return toInteger(left) === toInteger(right);
    case "-ne":
      return toInteger(left) !== toInteger(right);
    case "-lt":
      return toInteger(left) < toInteger(right);
    case "-le":
      return toInteger(left) <= toInteger(right);
    case "-gt":
      return toInteger(left) > toInteger(right);
    case "-ge":
      return toInteger(left) >= toInteger(right);
    default:
      throw new TestSyntaxError(`unknown binary operator '${op}'`);
  }
}

const FILE_UNARY_OPERATORS = new Set(["-e", "-f", "-d", "-s", "-r", "-w", "-x"]);

function evaluate(args: string[], context: CommandContext): boolean {
  if (args[0] === "!") return !evaluate(args.slice(1), context);

  if (args.length === 0) return false;
  if (args.length === 1) return args[0].length > 0;

  if (args.length === 2) {
    const [op, operand] = args;
    if (op === "-z") return operand.length === 0;
    if (op === "-n") return operand.length > 0;
    if (FILE_UNARY_OPERATORS.has(op)) return evalFileUnary(op, operand, context);
    throw new TestSyntaxError(`unknown unary operator '${op}'`);
  }

  if (args.length === 3) {
    const [left, op, right] = args;
    return evalBinary(left, op, right, context);
  }

  throw new TestSyntaxError("too many arguments");
}

function runTest(args: string[], context: CommandContext): CommandResult {
  try {
    return { stdout: "", stderr: "", exitCode: evaluate(args, context) ? 0 : 1 };
  } catch (error) {
    if (error instanceof TestSyntaxError) return fail(`test: ${error.message}`, 2);
    throw error;
  }
}

export const testCommand: CommandHandler = (args, context) => runTest(args, context);

export const bracketCommand: CommandHandler = (args, context) => {
  if (args[args.length - 1] !== "]") return fail("[: missing ']'", 2);
  return runTest(args.slice(0, -1), context);
};
