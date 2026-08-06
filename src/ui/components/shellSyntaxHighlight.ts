// スクリプト作成モード(docs/requirements.md 3章8節)のコードエディタ用シンタックスハイライト。
// `engine/shell` の字句解析器は構文エラーで例外を投げるため、入力途中(構文的に不完全)の
// テキストに対しては使えない。そのためここでは例外を投げない、行単位の軽量な正規表現ベースの
// トークナイザを別途用意し、色分けのみを目的とする(判定・実行には使わない)。

export type HighlightTokenType =
  | "comment"
  | "string"
  | "variable"
  | "keyword"
  | "operator"
  | "plain";

export interface HighlightToken {
  type: HighlightTokenType;
  text: string;
}

/** if/for/while/case等の制御構造キーワード、および local/return 等の組み込み語。 */
const KEYWORDS = new Set([
  "if",
  "then",
  "elif",
  "else",
  "fi",
  "for",
  "in",
  "do",
  "done",
  "while",
  "until",
  "case",
  "esac",
  "function",
  "local",
  "return",
  "exit",
  "break",
  "continue",
]);

const WORD_CHAR = /[A-Za-z0-9_.\/-]/;
const NAME_START = /[A-Za-z_]/;
const NAME_CONT = /[A-Za-z0-9_]/;
/** `$?` `$#` `$@` `$*` `$$` `$!` `$-` `$0`-`$9` のような、識別子以外の特殊パラメータ。 */
const SPECIAL_PARAM = new Set(["?", "#", "@", "*", "$", "!", "-", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);

/**
 * `$NAME` / `${NAME...}` / `$?` のような変数参照を先頭から読み取り、消費した文字数を返す
 * (`$` の直後が変数として解釈できない場合は0を返す)。
 */
function scanVariableLength(line: string, start: number): number {
  if (line[start] !== "$") return 0;
  const next = line[start + 1];
  if (next === undefined) return 0;

  if (next === "{") {
    let depth = 1;
    let i = start + 2;
    while (i < line.length && depth > 0) {
      if (line[i] === "{") depth += 1;
      else if (line[i] === "}") depth -= 1;
      i += 1;
    }
    return i - start;
  }

  if (SPECIAL_PARAM.has(next)) return 2;

  if (NAME_START.test(next)) {
    let i = start + 2;
    while (i < line.length && NAME_CONT.test(line[i])) i += 1;
    return i - start;
  }

  return 0;
}

/** ダブルクォート文字列の中身を、変数参照とそれ以外に分割してトークンを積む(bashの展開規則に合わせる)。 */
function pushDoubleQuoteContent(tokens: HighlightToken[], content: string): void {
  let buffer = "";
  let i = 0;
  while (i < content.length) {
    const varLength = scanVariableLength(content, i);
    if (varLength > 0) {
      if (buffer.length > 0) {
        tokens.push({ type: "string", text: buffer });
        buffer = "";
      }
      tokens.push({ type: "variable", text: content.slice(i, i + varLength) });
      i += varLength;
      continue;
    }
    if (content[i] === "\\" && i + 1 < content.length) {
      buffer += content.slice(i, i + 2);
      i += 2;
      continue;
    }
    buffer += content[i];
    i += 1;
  }
  if (buffer.length > 0) tokens.push({ type: "string", text: buffer });
}

const OPERATOR_CHARS = new Set(["|", "&", ";", "<", ">", "(", ")"]);

/**
 * 1行分のシェルスクリプトをハイライト用トークン列に変換する。改行は含まない前提で、
 * 呼び出し側(CodeEditor)が行ごとに呼び出す。前の行にまたがるヒアドキュメント本文等は
 * 区別しない(全て通常のコードとして扱う)簡易実装。
 */
export function tokenizeShellLine(line: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    if (ch === "#") {
      tokens.push({ type: "comment", text: line.slice(i) });
      break;
    }

    if (ch === " " || ch === "\t") {
      let j = i;
      while (j < line.length && (line[j] === " " || line[j] === "\t")) j += 1;
      tokens.push({ type: "plain", text: line.slice(i, j) });
      i = j;
      continue;
    }

    if (ch === "'") {
      let j = i + 1;
      while (j < line.length && line[j] !== "'") j += 1;
      const end = j < line.length ? j + 1 : j;
      tokens.push({ type: "string", text: line.slice(i, end) });
      i = end;
      continue;
    }

    if (ch === '"') {
      let j = i + 1;
      while (j < line.length && line[j] !== '"') {
        j += line[j] === "\\" && j + 1 < line.length ? 2 : 1;
      }
      const end = j < line.length ? j + 1 : j;
      tokens.push({ type: "string", text: '"' });
      pushDoubleQuoteContent(tokens, line.slice(i + 1, Math.min(j, line.length)));
      if (end > j) tokens.push({ type: "string", text: '"' });
      i = end;
      continue;
    }

    if (ch === "$") {
      const varLength = scanVariableLength(line, i);
      if (varLength > 0) {
        tokens.push({ type: "variable", text: line.slice(i, i + varLength) });
        i += varLength;
        continue;
      }
    }

    if (OPERATOR_CHARS.has(ch)) {
      let j = i;
      while (j < line.length && OPERATOR_CHARS.has(line[j])) j += 1;
      tokens.push({ type: "operator", text: line.slice(i, j) });
      i = j;
      continue;
    }

    if (WORD_CHAR.test(ch)) {
      let j = i;
      while (j < line.length && WORD_CHAR.test(line[j])) j += 1;
      const word = line.slice(i, j);
      tokens.push({ type: KEYWORDS.has(word) ? "keyword" : "plain", text: word });
      i = j;
      continue;
    }

    tokens.push({ type: "plain", text: ch });
    i += 1;
  }

  return tokens;
}

/** ダークテーマのターミナル配色(`Terminal.tsx`)と統一感のある、トークン種別ごとの表示色。 */
export const HIGHLIGHT_COLORS: Record<HighlightTokenType, string> = {
  comment: "#8b949e",
  string: "#a5d6ff",
  variable: "#79c0ff",
  keyword: "#ff7b72",
  operator: "#d2a8ff",
  plain: "#e6edf3",
};
