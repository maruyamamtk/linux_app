import { ShellSyntaxError } from "./errors";
import type { DoubleQuotedInnerPart, Script, Word, WordPart } from "./ast";

export type OperatorValue = "|" | ";" | "&&" | "||" | ">" | ">>" | "<" | ">&" | "<&";

export type Token =
  | { type: "Word"; word: Word; position: number }
  | { type: "IoNumber"; value: number; position: number }
  | { type: "Operator"; value: OperatorValue; position: number }
  | { type: "Newline"; position: number }
  | { type: "EOF"; position: number };

/** `$(...)` の中身をコマンド置換のASTへ変換する関数。再帰下降パーサ側から渡される。 */
export type ResolveCommandSubstitution = (source: string) => Script;

const IDENTIFIER_START = /[A-Za-z_]/;
const IDENTIFIER_PART = /[A-Za-z0-9_]/;
const SPECIAL_PARAMETER = new Set(["?", "#", "@", "*", "$", "!", "-", "0"]);

function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= "0" && ch <= "9";
}

function isWordTerminator(ch: string | undefined): boolean {
  return (
    ch === undefined ||
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

/** シェルスクリプトの文字列をトークン列へ分解する。 */
export function tokenize(source: string, resolveCommandSubstitution: ResolveCommandSubstitution): Token[] {
  const tokens: Token[] = [];
  const n = source.length;
  let i = 0;

  while (i < n) {
    const ch = source[i];

    if (ch === " " || ch === "\t") {
      i += 1;
      continue;
    }
    if (ch === "\\" && source[i + 1] === "\n") {
      i += 2;
      continue;
    }
    if (ch === "\n") {
      tokens.push({ type: "Newline", position: i });
      i += 1;
      continue;
    }
    if (ch === "#") {
      while (i < n && source[i] !== "\n") i += 1;
      continue;
    }
    if (isDigit(ch)) {
      let j = i;
      while (j < n && isDigit(source[j])) j += 1;
      if (source[j] === "<" || source[j] === ">") {
        tokens.push({ type: "IoNumber", value: Number(source.slice(i, j)), position: i });
        i = j;
        continue;
      }
      // 数字の直後がリダイレクト演算子でなければ、単なる単語として扱う(下のscanWordへフォールスルー)。
    }
    if (ch === "|") {
      if (source[i + 1] === "|") {
        tokens.push({ type: "Operator", value: "||", position: i });
        i += 2;
      } else {
        tokens.push({ type: "Operator", value: "|", position: i });
        i += 1;
      }
      continue;
    }
    if (ch === "&") {
      if (source[i + 1] === "&") {
        tokens.push({ type: "Operator", value: "&&", position: i });
        i += 2;
        continue;
      }
      throw new ShellSyntaxError("バックグラウンド実行('&')には対応していません", i);
    }
    if (ch === ";") {
      tokens.push({ type: "Operator", value: ";", position: i });
      i += 1;
      continue;
    }
    if (ch === ">") {
      if (source[i + 1] === ">") {
        tokens.push({ type: "Operator", value: ">>", position: i });
        i += 2;
      } else if (source[i + 1] === "&") {
        tokens.push({ type: "Operator", value: ">&", position: i });
        i += 2;
      } else {
        tokens.push({ type: "Operator", value: ">", position: i });
        i += 1;
      }
      continue;
    }
    if (ch === "<") {
      if (source[i + 1] === "<") {
        throw new ShellSyntaxError("ヒアドキュメント('<<')には対応していません", i);
      }
      if (source[i + 1] === "&") {
        tokens.push({ type: "Operator", value: "<&", position: i });
        i += 2;
      } else {
        tokens.push({ type: "Operator", value: "<", position: i });
        i += 1;
      }
      continue;
    }
    if (ch === "(" || ch === ")") {
      throw new ShellSyntaxError(`サブシェル構文('${ch}')には対応していません`, i);
    }

    const { word, end } = scanWord(source, i, resolveCommandSubstitution);
    tokens.push({ type: "Word", word, position: i });
    i = end;
  }

  tokens.push({ type: "EOF", position: n });
  return tokens;
}

function scanWord(
  source: string,
  start: number,
  resolveCommandSubstitution: ResolveCommandSubstitution,
): { word: Word; end: number } {
  let i = start;
  const parts: WordPart[] = [];
  let literalBuf = "";

  const flushLiteral = () => {
    if (literalBuf.length > 0) {
      parts.push({ type: "Literal", value: literalBuf });
      literalBuf = "";
    }
  };

  while (i < source.length && !isWordTerminator(source[i])) {
    const ch = source[i];

    if (ch === "'") {
      flushLiteral();
      const result = scanSingleQuoted(source, i + 1);
      parts.push({ type: "SingleQuoted", value: result.value });
      i = result.end;
      continue;
    }
    if (ch === '"') {
      flushLiteral();
      const result = scanDoubleQuoted(source, i + 1, resolveCommandSubstitution);
      parts.push({ type: "DoubleQuoted", parts: result.parts });
      i = result.end;
      continue;
    }
    if (ch === "\\") {
      const next = source[i + 1];
      if (next === "\n") {
        // 行継続: バックスラッシュ+改行は単語の途中でも丸ごと消える。
        i += 2;
      } else if (next === undefined) {
        literalBuf += "\\";
        i += 1;
      } else {
        literalBuf += next;
        i += 2;
      }
      continue;
    }
    if (ch === "$") {
      const result = scanDollar(source, i, resolveCommandSubstitution);
      if (result === null) {
        literalBuf += "$";
        i += 1;
      } else {
        flushLiteral();
        parts.push(result.part);
        i = result.end;
      }
      continue;
    }
    if (ch === "`") {
      flushLiteral();
      const result = scanBacktick(source, i + 1);
      parts.push({
        type: "CommandSubstitution",
        command: resolveCommandSubstitution(result.source),
        style: "backtick",
      });
      i = result.end;
      continue;
    }

    literalBuf += ch;
    i += 1;
  }

  flushLiteral();
  return { word: { type: "Word", parts }, end: i };
}

function scanSingleQuoted(source: string, pos: number): { value: string; end: number } {
  const start = pos;
  let i = pos;
  while (i < source.length && source[i] !== "'") i += 1;
  if (i >= source.length) {
    throw new ShellSyntaxError("シングルクォートが閉じられていません", start - 1);
  }
  return { value: source.slice(start, i), end: i + 1 };
}

function scanDoubleQuoted(
  source: string,
  pos: number,
  resolveCommandSubstitution: ResolveCommandSubstitution,
): { parts: DoubleQuotedInnerPart[]; end: number } {
  const start = pos;
  let i = pos;
  const parts: DoubleQuotedInnerPart[] = [];
  let literalBuf = "";

  const flushLiteral = () => {
    if (literalBuf.length > 0) {
      parts.push({ type: "Literal", value: literalBuf });
      literalBuf = "";
    }
  };

  while (i < source.length && source[i] !== '"') {
    const ch = source[i];

    if (ch === "\\") {
      const next = source[i + 1];
      if (next === "$" || next === "`" || next === '"' || next === "\\") {
        literalBuf += next;
        i += 2;
      } else if (next === "\n") {
        i += 2;
      } else {
        literalBuf += "\\";
        i += 1;
      }
      continue;
    }
    if (ch === "$") {
      const result = scanDollar(source, i, resolveCommandSubstitution);
      if (result === null) {
        literalBuf += "$";
        i += 1;
      } else {
        flushLiteral();
        parts.push(result.part);
        i = result.end;
      }
      continue;
    }
    if (ch === "`") {
      flushLiteral();
      const result = scanBacktick(source, i + 1);
      parts.push({
        type: "CommandSubstitution",
        command: resolveCommandSubstitution(result.source),
        style: "backtick",
      });
      i = result.end;
      continue;
    }

    literalBuf += ch;
    i += 1;
  }

  if (i >= source.length) {
    throw new ShellSyntaxError("ダブルクォートが閉じられていません", start - 1);
  }
  flushLiteral();
  return { parts, end: i + 1 };
}

type DollarResult =
  | { part: Exclude<WordPart, { type: "SingleQuoted" | "DoubleQuoted" }>; end: number }
  | null;

function scanDollar(
  source: string,
  pos: number,
  resolveCommandSubstitution: ResolveCommandSubstitution,
): DollarResult {
  const next = source[pos + 1];
  if (next === undefined) return null;

  if (next === "(") {
    if (source[pos + 2] === "(") {
      const result = scanArithmeticExpansion(source, pos + 3);
      return { part: { type: "ArithmeticExpansion", expression: result.expression }, end: result.end };
    }
    const result = scanCommandSubstitutionParens(source, pos + 2);
    return {
      part: {
        type: "CommandSubstitution",
        command: resolveCommandSubstitution(result.source),
        style: "dollar",
      },
      end: result.end,
    };
  }
  if (next === "{") {
    const result = scanBraceVariable(source, pos + 2);
    return { part: { type: "Variable", name: result.name, braced: true }, end: result.end };
  }
  if (IDENTIFIER_START.test(next)) {
    let j = pos + 1;
    while (j < source.length && IDENTIFIER_PART.test(source[j])) j += 1;
    return { part: { type: "Variable", name: source.slice(pos + 1, j), braced: false }, end: j };
  }
  if (isDigit(next) || SPECIAL_PARAMETER.has(next)) {
    return { part: { type: "Variable", name: next, braced: false }, end: pos + 2 };
  }
  return null;
}

/**
 * `pos` は `$((` の直後を指す。`$((...))` の終端は ')' 2文字の連続で、式内部の丸括弧
 * (グルーピング)とは区別する必要があるため、深さ0の ')' の直後にもう1つ ')' が続く場合のみを
 * 終端とみなす。
 */
function scanArithmeticExpansion(source: string, pos: number): { expression: string; end: number } {
  const start = pos;
  let i = pos;
  let depth = 0;
  let quote: '"' | "'" | null = null;

  while (i < source.length) {
    const ch = source[i];
    if (quote) {
      if (ch === "\\" && quote === '"') {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "(") {
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === ")") {
      if (depth === 0) {
        if (source[i + 1] === ")") {
          return { expression: source.slice(start, i), end: i + 2 };
        }
        throw new ShellSyntaxError("算術展開('$((...))')が閉じられていません", start - 3);
      }
      depth -= 1;
      i += 1;
      continue;
    }
    i += 1;
  }

  throw new ShellSyntaxError("算術展開('$((...))')が閉じられていません", start - 3);
}

/** `pos` は `$(` の直後を指す。ネストした `$(...)` ・クォートを考慮して閉じる `)` を探す。 */
function scanCommandSubstitutionParens(source: string, pos: number): { source: string; end: number } {
  const start = pos;
  let i = pos;
  let depth = 1;
  let quote: '"' | "'" | null = null;

  while (i < source.length) {
    const ch = source[i];
    if (quote) {
      if (ch === "\\" && quote === '"') {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "(") {
      depth += 1;
    } else if (ch === ")") {
      depth -= 1;
      if (depth === 0) break;
    }
    i += 1;
  }

  if (depth !== 0) {
    throw new ShellSyntaxError("コマンド置換('$(...)')が閉じられていません", start - 2);
  }
  return { source: source.slice(start, i), end: i + 1 };
}

/** `pos` は `${` の直後を指す。ネストした `{...}` ・クォートを考慮して閉じる `}` を探す。 */
function scanBraceVariable(source: string, pos: number): { name: string; end: number } {
  const start = pos;
  let i = pos;
  let depth = 1;
  let quote: '"' | "'" | null = null;

  while (i < source.length) {
    const ch = source[i];
    if (quote) {
      if (ch === "\\" && quote === '"') {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) break;
    }
    i += 1;
  }

  if (depth !== 0) {
    throw new ShellSyntaxError("変数展開('${...}')が閉じられていません", start - 2);
  }
  return { name: source.slice(start, i), end: i + 1 };
}

function scanBacktick(source: string, pos: number): { source: string; end: number } {
  const start = pos;
  let i = pos;
  let buf = "";

  while (i < source.length && source[i] !== "`") {
    if (source[i] === "\\" && (source[i + 1] === "`" || source[i + 1] === "\\" || source[i + 1] === "$")) {
      buf += source[i + 1];
      i += 2;
      continue;
    }
    buf += source[i];
    i += 1;
  }

  if (i >= source.length) {
    throw new ShellSyntaxError("バッククォートによるコマンド置換が閉じられていません", start - 1);
  }
  return { source: buf, end: i + 1 };
}
