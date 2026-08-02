// AST上のWord(WordPart[]) → 実行時文字列への展開。
// 字句解析の時点でクォート境界・コマンド置換/算術展開の構造は解決済みなので、
// ここでは各WordPartの「値」を決定して連結するだけでよい(グロブは行わない)。
// 単語分割(IFS)は、単純コマンドの引数語・forの単語リストなど一部の文脈でのみ必要となるため
// `expandWordToFields` として別途提供する(expandWord自体は常に単一の文字列を返す)。
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

/** IFS未設定時のデフォルト値(スペース・タブ・改行)。 */
const DEFAULT_IFS = " \t\n";

interface Chunk {
  text: string;
  /** ダブルクォートされていない、パラメータ展開・コマンド置換・算術展開の結果であればtrue。 */
  splittable: boolean;
}

function isFieldSplittablePart(part: WordPart): boolean {
  return (
    (part.type === "ParameterExpansion" || part.type === "CommandSubstitution" || part.type === "ArithmeticExpansion") &&
    !part.quoted
  );
}

/**
 * `Word` をIFS(内部フィールド区切り文字)に基づいて複数の文字列(フィールド)へ展開する。
 * 単純コマンドの引数語・`for ... in` の単語リストなど、実シェルで単語分割が起こる文脈でのみ使う
 * (代入の右辺・リダイレクト先・caseのパターン等では分割は起こらないため、通常は`expandWord`を使う)。
 *
 * 分割の対象になるのは「クォートされていない」パラメータ展開・コマンド置換・算術展開の結果のみ
 * (リテラルなテキスト・シングルクォート・ダブルクォートされた展開はいずれも分割されない)。
 * IFSがスペース・タブ・改行のみで構成される場合は連続する区切り文字を1つの区切りとみなし、
 * 単語の前後の区切り文字は無視する。それ以外の文字(例: `:`)は1文字ごとに区切りとみなすため、
 * 連続すると空フィールドが生まれる(`IFS=: ` での `"a::b"` → `["a", "", "b"]` 等)。
 * 実シェルは非空白IFS文字の直後に続く空白IFS文字もまとめて1つの区切りとして扱うが、
 * 本実装ではその特例は近似せず単純に文字ごとに判定する(教材用途では十分な近似とする)。
 */
export function expandWordToFields(word: Word, state: ShellState): string[] {
  const chunks: Chunk[] = word.parts.map((part) => ({
    text: expandPart(part, state),
    splittable: isFieldSplittablePart(part),
  }));

  const ifs = state.context.env.IFS ?? DEFAULT_IFS;
  if (ifs === "" || !chunks.some((chunk) => chunk.splittable)) {
    return [chunks.map((chunk) => chunk.text).join("")];
  }

  return splitChunksByIfs(chunks, ifs);
}

function splitChunksByIfs(chunks: Chunk[], ifs: string): string[] {
  const ifsChars = new Set(ifs);
  const isWhitespaceIfsChar = (ch: string): boolean => ifsChars.has(ch) && (ch === " " || ch === "\t" || ch === "\n");

  const fields: string[] = [];
  let current = "";
  /** 現在のフィールドに(空文字列も含め)確定済みの内容があるか。 */
  let pendingField = false;

  const endField = (): void => {
    fields.push(current);
    current = "";
    pendingField = false;
  };

  for (const chunk of chunks) {
    if (!chunk.splittable) {
      current += chunk.text;
      pendingField = true;
      continue;
    }

    for (const ch of chunk.text) {
      if (!ifsChars.has(ch)) {
        current += ch;
        pendingField = true;
        continue;
      }
      if (isWhitespaceIfsChar(ch)) {
        if (pendingField) endField();
        continue;
      }
      // 非空白のIFS文字は、隣接していても区切りごとに(空でも)フィールドを確定させる。
      endField();
    }
  }
  if (pendingField) endField();

  return fields;
}
