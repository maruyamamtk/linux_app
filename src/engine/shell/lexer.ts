// 文字列 → トークン列。
// 単語(WORD)トークンは、クォート解除・変数展開・コマンド置換・算術展開まで
// この段階で解決した上でASTの WordPart[] として保持する(実シェルの字句解析と同様、
// クォート境界を無視して演算子を判定できないため)。
// コマンド置換 `$()` / `` ` ` `` の中身は再帰的に parser.ts の parseScript を呼び出して
// Script として解決する(lexer⇄parserの相互参照は関数内でのみ発生するため問題ない)。
import type {
  ArithmeticExpansionPart,
  CommandSubstitutionPart,
  ParameterExpansionPart,
  SingleQuotedPart,
  Word,
  WordPart,
} from "./ast";
import { ShellSyntaxError } from "./errors";
import { parseScript } from "./parser";

export type OperatorValue = "|" | "||" | "&&" | ";" | ";;" | ">" | ">>" | "<" | ">&" | "<&" | "(" | ")";

export interface WordToken {
  type: "WORD";
  word: Word;
  raw: string;
  start: number;
  end: number;
}

export interface IoNumberToken {
  type: "IO_NUMBER";
  value: number;
  start: number;
  end: number;
}

export interface OperatorToken {
  type: "OPERATOR";
  value: OperatorValue;
  start: number;
  end: number;
}

export interface NewlineToken {
  type: "NEWLINE";
  start: number;
  end: number;
}

export interface EofToken {
  type: "EOF";
  start: number;
  end: number;
}

export type Token = WordToken | IoNumberToken | OperatorToken | NewlineToken | EofToken;

const NAME_START = /[A-Za-z_]/;
const NAME_CONT = /[A-Za-z0-9_]/;
/** `$?` `$#` `$@` `$*` `$$` `$!` `$-` `$0` のような、識別子以外の特殊パラメータ。 */
const SPECIAL_PARAM = new Set(["?", "#", "@", "*", "$", "!", "-", "0"]);

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function isWordBoundaryChar(ch: string): boolean {
  return (
    ch === " " ||
    ch === "\t" ||
    ch === "\n" ||
    ch === "|" ||
    ch === "&" ||
    ch === ";" ||
    ch === "<" ||
    ch === ">" ||
    ch === "(" ||
    ch === ")"
  );
}

class CharScanner {
  constructor(
    readonly input: string,
    public pos: number = 0,
  ) {}

  peek(offset = 0): string | undefined {
    return this.input[this.pos + offset];
  }

  eof(): boolean {
    return this.pos >= this.input.length;
  }

  advance(): string {
    const ch = this.input[this.pos];
    this.pos += 1;
    return ch;
  }
}

export function tokenize(input: string): Token[] {
  const scanner = new CharScanner(input);
  const tokens: Token[] = [];

  for (;;) {
    skipBlanksAndComments(scanner);

    if (scanner.eof()) {
      tokens.push({ type: "EOF", start: scanner.pos, end: scanner.pos });
      break;
    }

    const start = scanner.pos;
    const ch = scanner.peek()!;

    if (ch === "\n") {
      scanner.advance();
      tokens.push({ type: "NEWLINE", start, end: scanner.pos });
      continue;
    }

    if (ch === ";") {
      scanner.advance();
      if (scanner.peek() === ";") {
        scanner.advance();
        tokens.push({ type: "OPERATOR", value: ";;", start, end: scanner.pos });
      } else {
        tokens.push({ type: "OPERATOR", value: ";", start, end: scanner.pos });
      }
      continue;
    }

    if (ch === "|") {
      scanner.advance();
      if (scanner.peek() === "|") {
        scanner.advance();
        tokens.push({ type: "OPERATOR", value: "||", start, end: scanner.pos });
      } else {
        tokens.push({ type: "OPERATOR", value: "|", start, end: scanner.pos });
      }
      continue;
    }

    if (ch === "&") {
      scanner.advance();
      if (scanner.peek() === "&") {
        scanner.advance();
        tokens.push({ type: "OPERATOR", value: "&&", start, end: scanner.pos });
        continue;
      }
      throw new ShellSyntaxError("バックグラウンド実行(&)には対応していません", start);
    }

    if (ch === "<") {
      scanner.advance();
      if (scanner.peek() === "<") {
        throw new ShellSyntaxError(
          "ヒアドキュメント/ヒアストリング(<<, <<<)には対応していません",
          start,
        );
      }
      if (scanner.peek() === "&") {
        scanner.advance();
        tokens.push({ type: "OPERATOR", value: "<&", start, end: scanner.pos });
        continue;
      }
      tokens.push({ type: "OPERATOR", value: "<", start, end: scanner.pos });
      continue;
    }

    if (ch === ">") {
      scanner.advance();
      if (scanner.peek() === ">") {
        scanner.advance();
        tokens.push({ type: "OPERATOR", value: ">>", start, end: scanner.pos });
        continue;
      }
      if (scanner.peek() === "&") {
        scanner.advance();
        tokens.push({ type: "OPERATOR", value: ">&", start, end: scanner.pos });
        continue;
      }
      tokens.push({ type: "OPERATOR", value: ">", start, end: scanner.pos });
      continue;
    }

    if (ch === "(") {
      scanner.advance();
      tokens.push({ type: "OPERATOR", value: "(", start, end: scanner.pos });
      continue;
    }

    if (ch === ")") {
      scanner.advance();
      tokens.push({ type: "OPERATOR", value: ")", start, end: scanner.pos });
      continue;
    }

    if (isDigit(ch)) {
      let lookahead = scanner.pos;
      while (lookahead < input.length && isDigit(input[lookahead])) lookahead += 1;
      const next = input[lookahead];
      if (next === "<" || next === ">") {
        const value = Number(input.slice(scanner.pos, lookahead));
        scanner.pos = lookahead;
        tokens.push({ type: "IO_NUMBER", value, start, end: scanner.pos });
        continue;
      }
    }

    const word = scanWord(scanner);
    tokens.push({
      type: "WORD",
      word: word.word,
      raw: input.slice(start, scanner.pos),
      start,
      end: scanner.pos,
    });
  }

  return tokens;
}

function skipBlanksAndComments(scanner: CharScanner): void {
  for (;;) {
    while (scanner.peek() === " " || scanner.peek() === "\t") scanner.advance();

    if (scanner.peek() === "#") {
      while (!scanner.eof() && scanner.peek() !== "\n") scanner.advance();
      continue;
    }

    if (scanner.peek() === "\\" && scanner.peek(1) === "\n") {
      scanner.advance();
      scanner.advance();
      continue;
    }

    break;
  }
}

function scanWordChars(scanner: CharScanner, isBoundary: (ch: string) => boolean): WordPart[] {
  const parts: WordPart[] = [];
  let buffer = "";

  const flush = (): void => {
    if (buffer.length > 0) {
      parts.push({ type: "Text", value: buffer });
      buffer = "";
    }
  };

  while (!scanner.eof()) {
    const ch = scanner.peek()!;
    if (isBoundary(ch)) break;

    if (ch === "\\") {
      scanner.advance();
      const next = scanner.peek();
      if (next === undefined) {
        // 行末の孤立したバックスラッシュはリテラルとして扱う
        buffer += "\\";
        break;
      }
      scanner.advance();
      if (next === "\n") continue; // 行継続: 単語を跨いで読み進める
      buffer += next;
      continue;
    }

    if (ch === "'") {
      flush();
      scanner.advance();
      parts.push(scanSingleQuoted(scanner));
      continue;
    }

    if (ch === '"') {
      flush();
      scanner.advance();
      parts.push(...scanDoubleQuoted(scanner));
      continue;
    }

    if (ch === "$") {
      const part = tryScanDollarExpansion(scanner);
      if (part) {
        flush();
        parts.push(part);
        continue;
      }
      buffer += scanner.advance();
      continue;
    }

    if (ch === "`") {
      flush();
      parts.push(scanBacktickSubstitution(scanner));
      continue;
    }

    buffer += scanner.advance();
  }

  flush();
  return parts;
}

function scanWord(scanner: CharScanner): { word: Word } {
  const startPos = scanner.pos;
  const parts = scanWordChars(scanner, isWordBoundaryChar);
  if (parts.length === 0) {
    throw new ShellSyntaxError("空の単語です", startPos);
  }
  return { word: { type: "Word", parts } };
}

/** `${var:-word}` の word 部分のように、空白でも区切られない単語をパースする。 */
function parseWordFromString(text: string): Word {
  const scanner = new CharScanner(text);
  const parts = scanWordChars(scanner, () => false);
  if (parts.length === 0) parts.push({ type: "Text", value: "" });
  return { type: "Word", parts };
}

function scanSingleQuoted(scanner: CharScanner): SingleQuotedPart {
  const start = scanner.pos;
  let value = "";
  for (;;) {
    if (scanner.eof()) {
      throw new ShellSyntaxError("シングルクォートが閉じられていません", start);
    }
    const ch = scanner.advance();
    if (ch === "'") break;
    value += ch;
  }
  return { type: "SingleQuoted", value };
}

function scanDoubleQuoted(scanner: CharScanner): WordPart[] {
  const start = scanner.pos;
  const parts: WordPart[] = [];
  let buffer = "";
  const flush = (): void => {
    if (buffer.length > 0) {
      parts.push({ type: "Text", value: buffer });
      buffer = "";
    }
  };

  for (;;) {
    if (scanner.eof()) {
      throw new ShellSyntaxError("ダブルクォートが閉じられていません", start);
    }
    const ch = scanner.peek()!;

    if (ch === '"') {
      scanner.advance();
      break;
    }

    if (ch === "\\") {
      scanner.advance();
      const next = scanner.peek();
      if (next === undefined) {
        throw new ShellSyntaxError("ダブルクォートが閉じられていません", start);
      }
      scanner.advance();
      if (next === "\n") continue; // 行継続
      if (next === "$" || next === "`" || next === '"' || next === "\\") {
        buffer += next;
      } else {
        // これら以外の文字の前のバックスラッシュはダブルクォート内では保持される
        buffer += "\\" + next;
      }
      continue;
    }

    if (ch === "$") {
      const part = tryScanDollarExpansion(scanner);
      if (part) {
        flush();
        parts.push(part);
        continue;
      }
      buffer += scanner.advance();
      continue;
    }

    if (ch === "`") {
      flush();
      parts.push(scanBacktickSubstitution(scanner));
      continue;
    }

    buffer += scanner.advance();
  }

  flush();
  return parts;
}

function tryScanDollarExpansion(scanner: CharScanner): WordPart | undefined {
  const next = scanner.peek(1);

  if (next === "(") {
    if (scanner.peek(2) === "(") {
      return scanArithmeticExpansion(scanner);
    }
    return scanCommandSubstitution(scanner);
  }

  if (next === "{") {
    return scanBracedParameterExpansion(scanner);
  }

  if (next !== undefined && SPECIAL_PARAM.has(next)) {
    scanner.advance(); // $
    scanner.advance(); // 特殊文字
    return { type: "ParameterExpansion", name: next };
  }

  if (next !== undefined && isDigit(next)) {
    scanner.advance(); // $
    scanner.advance(); // 数字1桁(位置パラメータ。複数桁は ${10} のように波括弧が必要)
    return { type: "ParameterExpansion", name: next };
  }

  if (next !== undefined && NAME_START.test(next)) {
    scanner.advance(); // $
    let name = scanner.advance();
    while (scanner.peek() !== undefined && NAME_CONT.test(scanner.peek()!)) {
      name += scanner.advance();
    }
    return { type: "ParameterExpansion", name };
  }

  return undefined;
}

function scanArithmeticExpansion(scanner: CharScanner): ArithmeticExpansionPart {
  const start = scanner.pos;
  scanner.advance(); // $
  scanner.advance(); // (
  scanner.advance(); // (
  let expression = "";
  let depth = 0;

  for (;;) {
    if (scanner.eof()) {
      throw new ShellSyntaxError("算術展開 $(( )) が閉じられていません", start);
    }
    const ch = scanner.advance();
    if (ch === "(") {
      depth += 1;
      expression += ch;
      continue;
    }
    if (ch === ")") {
      if (depth === 0) {
        if (scanner.peek() === ")") {
          scanner.advance();
          break;
        }
        throw new ShellSyntaxError("算術展開 $(( )) が閉じられていません", start);
      }
      depth -= 1;
      expression += ch;
      continue;
    }
    expression += ch;
  }

  return { type: "ArithmeticExpansion", expression: expression.trim() };
}

function scanCommandSubstitution(scanner: CharScanner): CommandSubstitutionPart {
  const start = scanner.pos;
  scanner.advance(); // $
  const openParenIndex = scanner.pos;
  scanner.advance(); // (
  const closeIndex = findMatchingParen(scanner.input, openParenIndex, start);
  const inner = scanner.input.slice(scanner.pos, closeIndex);
  scanner.pos = closeIndex + 1;
  return { type: "CommandSubstitution", script: parseScript(inner) };
}

function scanBacktickSubstitution(scanner: CharScanner): CommandSubstitutionPart {
  const start = scanner.pos;
  scanner.advance(); // `
  let raw = "";
  for (;;) {
    if (scanner.eof()) {
      throw new ShellSyntaxError("コマンド置換 ` ` が閉じられていません", start);
    }
    const ch = scanner.advance();
    if (ch === "`") break;
    if (ch === "\\") {
      const next = scanner.peek();
      if (next === "`" || next === "\\" || next === "$") {
        raw += scanner.advance();
        continue;
      }
      raw += ch;
      continue;
    }
    raw += ch;
  }
  return { type: "CommandSubstitution", script: parseScript(raw) };
}

function scanBracedParameterExpansion(scanner: CharScanner): ParameterExpansionPart {
  const start = scanner.pos;
  scanner.advance(); // $
  scanner.advance(); // {
  const closeIndex = findMatchingBrace(scanner.input, scanner.pos, start);
  const inner = scanner.input.slice(scanner.pos, closeIndex);
  scanner.pos = closeIndex + 1;
  return parseParameterExpansionBody(inner, start);
}

function parseParameterExpansionBody(inner: string, start: number): ParameterExpansionPart {
  let body = inner;
  let length = false;

  if (body.startsWith("#") && body.length > 1) {
    const rest = body.slice(1);
    if (isValidParamName(rest) || isSpecialOrPositional(rest)) {
      length = true;
      body = rest;
    }
  }

  const nameMatch = /^([A-Za-z_][A-Za-z0-9_]*|[0-9]+|[?#@*$!-])/.exec(body);
  if (!nameMatch) {
    throw new ShellSyntaxError(`不正なパラメータ展開です: \${${inner}}`, start);
  }
  const name = nameMatch[1];
  const rest = body.slice(name.length);

  if (rest.length === 0) {
    return length ? { type: "ParameterExpansion", name, length: true } : { type: "ParameterExpansion", name };
  }

  const opMatch = /^(:-|:=|:\?|:\+|-|=|\?|\+)/.exec(rest);
  if (!opMatch) {
    throw new ShellSyntaxError(`不正なパラメータ展開です: \${${inner}}`, start);
  }
  const operator = opMatch[1] as ParameterExpansionPart["operator"];
  const word = parseWordFromString(rest.slice(opMatch[1].length));

  return length
    ? { type: "ParameterExpansion", name, operator, word, length: true }
    : { type: "ParameterExpansion", name, operator, word };
}

function isValidParamName(s: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(s);
}

function isSpecialOrPositional(s: string): boolean {
  return /^[0-9]+$/.test(s) || SPECIAL_PARAM.has(s);
}

/** クォート・ネストしたコマンド置換を考慮して、対応する閉じ括弧の位置を返す。 */
function findMatchingParen(input: string, openIndex: number, errorStart: number): number {
  let depth = 1;
  let i = openIndex + 1;
  while (i < input.length) {
    const ch = input[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "'") {
      i = skipRawUntil(input, i + 1, "'", errorStart);
      continue;
    }
    if (ch === '"') {
      i = skipRawUntil(input, i + 1, '"', errorStart);
      continue;
    }
    if (ch === "`") {
      i = skipRawUntil(input, i + 1, "`", errorStart);
      continue;
    }
    if (ch === "(") {
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === ")") {
      depth -= 1;
      i += 1;
      if (depth === 0) return i - 1;
      continue;
    }
    i += 1;
  }
  throw new ShellSyntaxError("コマンド置換 $( ) が閉じられていません", errorStart);
}

/** クォート・ネストしたコマンド置換を考慮して、対応する `}` の位置を返す。 */
function findMatchingBrace(input: string, openIndex: number, errorStart: number): number {
  let depth = 1;
  let i = openIndex;
  while (i < input.length) {
    const ch = input[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "'") {
      i = skipRawUntil(input, i + 1, "'", errorStart);
      continue;
    }
    if (ch === '"') {
      i = skipRawUntil(input, i + 1, '"', errorStart);
      continue;
    }
    if (ch === "`") {
      i = skipRawUntil(input, i + 1, "`", errorStart);
      continue;
    }
    if (ch === "$" && input[i + 1] === "(") {
      i = findMatchingParen(input, i + 1, errorStart) + 1;
      continue;
    }
    if (ch === "{") {
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      i += 1;
      if (depth === 0) return i - 1;
      continue;
    }
    i += 1;
  }
  throw new ShellSyntaxError("パラメータ展開 ${ } が閉じられていません", errorStart);
}

function skipRawUntil(input: string, start: number, quoteChar: string, errorStart: number): number {
  let i = start;
  while (i < input.length) {
    const ch = input[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === quoteChar) return i + 1;
    i += 1;
  }
  throw new ShellSyntaxError(`${quoteChar} が閉じられていません`, errorStart);
}
