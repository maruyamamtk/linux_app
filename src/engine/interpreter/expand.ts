// AST上のWord(WordPart[]) → 実行時文字列への展開。
// 字句解析の時点でクォート境界・コマンド置換/算術展開の構造は解決済みなので、
// ここでは各WordPartの「値」を決定して連結するだけでよい(グロブ・単語分割は行わない。
// 各Wordはトークン化の時点で既に空白区切りされているため、本パーサの設計上そもそも不要)。
import type { ParameterExpansionPart, Word, WordPart } from "../shell";
import { evaluateArithmetic } from "./arithmetic";
import { ShellRuntimeError } from "./errors";
import type { ShellState } from "./types";

export function expandWord(word: Word, state: ShellState): string {
  return word.parts.map((part) => expandPart(part, state)).join("");
}

function expandPart(part: WordPart, state: ShellState): string {
  switch (part.type) {
    case "Text":
    case "SingleQuoted":
      return part.value;
    case "ParameterExpansion":
      return expandParameter(part, state);
    case "CommandSubstitution": {
      const result = state.runSubshell(part.script);
      // bashと同様、末尾の改行はすべて取り除く(先頭・途中の空白/改行は保持する)。
      return result.stdout.replace(/\n+$/, "");
    }
    case "ArithmeticExpansion":
      return String(evaluateArithmetic(part.expression, state.context.env));
  }
}

function lookupParameter(name: string, state: ShellState): string | undefined {
  if (name === "?") return String(state.lastExitCode);
  if (name === "#") return String(state.positionalParams.length);
  // `$@`/`$*` は本来IFSで単語分割されるが、本パーサはWord単位の展開しか行わないため
  // (ファイル冒頭コメント参照)、両者とも単純にスペース区切りで連結する近似実装とする。
  if (name === "@" || name === "*") return state.positionalParams.join(" ");
  if (/^[1-9][0-9]*$/.test(name)) return state.positionalParams[Number(name) - 1];
  if (name === "0" || name === "$" || name === "!" || name === "-") return undefined;
  return state.context.env[name];
}

function expandParameter(part: ParameterExpansionPart, state: ShellState): string {
  const rawValue = lookupParameter(part.name, state);
  const isUnset = rawValue === undefined;
  const isEmpty = isUnset || rawValue.length === 0;

  if (part.length) {
    return String((rawValue ?? "").length);
  }

  if (!part.operator) {
    return rawValue ?? "";
  }

  const altWord = (): string => (part.word ? expandWord(part.word, state) : "");

  switch (part.operator) {
    case ":-":
      return isEmpty ? altWord() : (rawValue as string);
    case "-":
      return isUnset ? altWord() : (rawValue as string);
    case ":=":
      if (!isEmpty) return rawValue as string;
      return assignDefault(part.name, altWord(), state);
    case "=":
      if (!isUnset) return rawValue as string;
      return assignDefault(part.name, altWord(), state);
    case ":?":
      if (isEmpty) throwUnsetError(part.name, part.word, state);
      return rawValue as string;
    case "?":
      if (isUnset) throwUnsetError(part.name, part.word, state);
      return rawValue as string;
    case ":+":
      return isEmpty ? "" : altWord();
    case "+":
      return isUnset ? "" : altWord();
    default:
      return rawValue ?? "";
  }
}

function assignDefault(name: string, value: string, state: ShellState): string {
  state.context.env[name] = value;
  return value;
}

function throwUnsetError(name: string, word: Word | undefined, state: ShellState): never {
  const message = word ? expandWord(word, state) : "parameter null or not set";
  throw new ShellRuntimeError(`${name}: ${message}`);
}
