import { RegexSyntaxError } from "./errors";
import type { RegexNode } from "./types";

/**
 * BRE(基本正規表現)/ERE(拡張正規表現)の再帰下降パーサ。
 *
 * 対応構文:
 * - 共通: リテラル文字, `.`, `[...]` `[^...]` (範囲指定含む), `*`, `^` `$`, `\` によるメタ文字のエスケープ
 * - ERE(`extended: true`)のみ: `+` `?` `{m,n}` `(...)` `|`
 *
 * 簡略化のための方針(要件定義書 Ch13 相当のスコープに合わせる):
 * - BREはグループ化・区間指定・選択(`\(` `\{` `\|` 等のGNU拡張)を対象外とし、
 *   `(` `)` `{` `}` `|` `+` `?` はBRE中では常にリテラル文字として扱う。
 * - `^` はBREでは先頭要素としてのみアンカーになり、それ以外はリテラル文字。
 *   EREでは常にアンカーとして扱う。`$` も対称に扱う。
 * - `*` はパターン(または枝)の先頭要素として現れた場合のみリテラル文字。
 * - `\` は直後の1文字を常にリテラル化するエスケープとして扱う(BRE/ERE共通)。
 */

interface ParserState {
  readonly pattern: string;
  readonly extended: boolean;
  pos: number;
}

export function parsePattern(pattern: string, extended: boolean): RegexNode {
  const state: ParserState = { pattern, extended, pos: 0 };
  const node = parseAlternation(state);
  if (state.pos !== state.pattern.length) {
    throw new RegexSyntaxError(`Unexpected character '${state.pattern[state.pos]}' at position ${state.pos}`);
  }
  return node;
}

function peek(state: ParserState): string | undefined {
  return state.pattern[state.pos];
}

function parseAlternation(state: ParserState): RegexNode {
  const branches = [parseBranch(state)];
  while (state.extended && peek(state) === "|") {
    state.pos += 1;
    branches.push(parseBranch(state));
  }
  return branches.length === 1 ? branches[0] : { type: "alternation", branches };
}

function isBranchEnd(state: ParserState): boolean {
  const ch = peek(state);
  if (ch === undefined) return true;
  return state.extended && (ch === "|" || ch === ")");
}

function parseBranch(state: ParserState): RegexNode {
  const nodes: RegexNode[] = [];
  let atomIndex = 0;
  while (!isBranchEnd(state)) {
    const node = parseQuantified(state, atomIndex);
    nodes.push(node);
    if (node.type !== "startAnchor" && node.type !== "endAnchor") atomIndex += 1;
  }
  return { type: "concat", nodes };
}

function parseQuantified(state: ParserState, atomIndex: number): RegexNode {
  const atom = parseAtom(state, atomIndex);
  if (atom.type === "startAnchor" || atom.type === "endAnchor") return atom;
  return applyQuantifier(state, atom);
}

function applyQuantifier(state: ParserState, atom: RegexNode): RegexNode {
  const ch = peek(state);
  if (ch === "*") {
    state.pos += 1;
    return { type: "star", node: atom };
  }
  if (state.extended) {
    if (ch === "+") {
      state.pos += 1;
      return { type: "plus", node: atom };
    }
    if (ch === "?") {
      state.pos += 1;
      return { type: "question", node: atom };
    }
    if (ch === "{") {
      const interval = tryParseInterval(state);
      if (interval) return { type: "repeat", node: atom, min: interval.min, max: interval.max };
    }
  }
  return atom;
}

function tryParseInterval(state: ParserState): { min: number; max: number | null } | null {
  const { pattern } = state;
  let pos = state.pos + 1;

  let minStr = "";
  while (pos < pattern.length && /[0-9]/.test(pattern[pos])) {
    minStr += pattern[pos];
    pos += 1;
  }
  if (minStr === "") return null;

  let maxStr: string | undefined = minStr;
  if (pattern[pos] === ",") {
    pos += 1;
    let str = "";
    while (pos < pattern.length && /[0-9]/.test(pattern[pos])) {
      str += pattern[pos];
      pos += 1;
    }
    maxStr = str === "" ? undefined : str;
  }
  if (pattern[pos] !== "}") return null;

  state.pos = pos + 1;
  const min = Number(minStr);
  const max = maxStr === undefined ? null : Number(maxStr);
  if (max !== null && max < min) {
    throw new RegexSyntaxError(`Invalid interval {${minStr},${maxStr}}: max is less than min`);
  }
  return { min, max };
}

function parseAtom(state: ParserState, atomIndex: number): RegexNode {
  const ch = peek(state);
  if (ch === undefined) throw new RegexSyntaxError("Unexpected end of pattern");

  if (ch === "^" && (state.extended || state.pos === 0)) {
    state.pos += 1;
    return { type: "startAnchor" };
  }
  if (ch === "$" && (state.extended || state.pos === state.pattern.length - 1)) {
    state.pos += 1;
    return { type: "endAnchor" };
  }
  if (ch === ".") {
    state.pos += 1;
    return { type: "any" };
  }
  if (ch === "[") {
    return parseCharClass(state);
  }
  if (state.extended && ch === "(") {
    state.pos += 1;
    const inner = parseAlternation(state);
    if (peek(state) !== ")") throw new RegexSyntaxError("Missing closing ')'");
    state.pos += 1;
    return { type: "group", node: inner };
  }
  if (ch === "*" && atomIndex === 0) {
    state.pos += 1;
    return { type: "literal", char: "*" };
  }
  if (ch === "\\") {
    state.pos += 1;
    const escaped = peek(state);
    if (escaped === undefined) throw new RegexSyntaxError("Trailing backslash");
    state.pos += 1;
    return { type: "literal", char: escaped };
  }

  state.pos += 1;
  return { type: "literal", char: ch };
}

function parseCharClass(state: ParserState): RegexNode {
  state.pos += 1; // consume '['
  let negate = false;
  if (peek(state) === "^") {
    negate = true;
    state.pos += 1;
  }

  const chars = new Set<string>();
  const ranges: [string, string][] = [];
  let first = true;

  const readMember = (): string => {
    let ch = state.pattern[state.pos];
    state.pos += 1;
    if (ch === "\\" && state.pos < state.pattern.length) {
      ch = state.pattern[state.pos];
      state.pos += 1;
    }
    return ch;
  };

  for (;;) {
    const ch = peek(state);
    if (ch === undefined) throw new RegexSyntaxError("Unterminated character class");
    if (ch === "]" && !first) {
      state.pos += 1;
      break;
    }
    first = false;

    const member = readMember();
    if (peek(state) === "-" && state.pattern[state.pos + 1] !== undefined && state.pattern[state.pos + 1] !== "]") {
      state.pos += 1; // consume '-'
      const rangeEnd = readMember();
      ranges.push([member, rangeEnd]);
    } else {
      chars.add(member);
    }
  }

  return { type: "charClass", negate, chars, ranges };
}
