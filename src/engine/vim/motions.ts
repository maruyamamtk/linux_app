import { lastNormalCol } from "./buffer";
import type { CursorPosition, VimBuffer } from "./types";

export type MotionKind = "exclusive" | "inclusive" | "linewise";

export interface MotionResult {
  cursor: CursorPosition;
  kind: MotionKind;
}

/** `h`/`j`/`k`/`l`/`0`/`$`/`w`/`b`/`e`/`gg`/`G` のうち、モーションとして解釈可能なキーかどうか。 */
export function isMotionKey(key: string): boolean {
  return ["h", "j", "k", "l", "0", "$", "w", "b", "e", "gg", "G"].includes(key);
}

type CharClass = "space" | "word" | "punct";

function charClass(ch: string): CharClass {
  if (/\s/.test(ch)) return "space";
  if (/[A-Za-z0-9_]/.test(ch)) return "word";
  return "punct";
}

/** `cw` の特殊挙動("`cw`はカーソルが非空白上にあるとき`ce`と同じ"、`:help cw`)判定に使う。 */
export function isCursorOnBlank(buffer: VimBuffer, cursor: CursorPosition): boolean {
  const line = buffer.lines[cursor.line];
  if (cursor.col >= line.length) return true;
  return charClass(line[cursor.col]) === "space";
}

function moveHorizontal(buffer: VimBuffer, cursor: CursorPosition, delta: number): CursorPosition {
  const line = buffer.lines[cursor.line];
  const col = Math.min(Math.max(cursor.col + delta, 0), line.length);
  return { line: cursor.line, col };
}

function moveVertical(buffer: VimBuffer, cursor: CursorPosition, delta: number): CursorPosition {
  const line = Math.min(Math.max(cursor.line + delta, 0), buffer.lines.length - 1);
  const col = Math.min(cursor.col, lastNormalCol(buffer, line));
  return { line, col };
}

function gotoLine(buffer: VimBuffer, oneIndexedLine: number): CursorPosition {
  const line = Math.min(Math.max(oneIndexedLine - 1, 0), buffer.lines.length - 1);
  return { line, col: 0 };
}

/** `w`: 次の単語(または句読点の連続)の先頭へ1回分進む。行末では次行の先頭(または最初の非空白)へ。 */
function stepWordForward(buffer: VimBuffer, pos: CursorPosition): CursorPosition {
  const { lines } = buffer;
  let { line, col } = pos;
  const isLastLine = line === lines.length - 1;

  if (col < lines[line].length) {
    const cls = charClass(lines[line][col]);
    while (col < lines[line].length && charClass(lines[line][col]) === cls) col += 1;
  } else if (!isLastLine) {
    line += 1;
    col = 0;
    if (lines[line].length === 0) return { line, col: 0 };
  }

  while (col < lines[line].length && charClass(lines[line][col]) === "space") col += 1;

  if (col >= lines[line].length && line < lines.length - 1) {
    line += 1;
    col = 0;
    if (lines[line].length === 0) return { line, col: 0 };
    while (col < lines[line].length && charClass(lines[line][col]) === "space") col += 1;
    if (col >= lines[line].length) return { line, col: 0 };
    return { line, col };
  }

  return { line, col: Math.min(col, Math.max(0, lines[line].length - (line === lines.length - 1 ? 1 : 0))) };
}

export function wordForward(buffer: VimBuffer, cursor: CursorPosition, count: number): CursorPosition {
  let pos = cursor;
  for (let i = 0; i < count; i += 1) pos = stepWordForward(buffer, pos);
  return pos;
}

/** `b`: 前の単語(または句読点の連続)の先頭へ1回分戻る。 */
function stepWordBackward(buffer: VimBuffer, pos: CursorPosition): CursorPosition {
  const { lines } = buffer;
  let { line, col } = pos;

  if (col === 0) {
    if (line === 0) return { line: 0, col: 0 };
    line -= 1;
    col = lines[line].length;
    if (col === 0) return { line, col: 0 };
  }

  col -= 1;
  while (col > 0 && charClass(lines[line][col]) === "space") col -= 1;
  if (charClass(lines[line][col]) === "space") return { line, col: 0 };

  const cls = charClass(lines[line][col]);
  while (col > 0 && charClass(lines[line][col - 1]) === cls) col -= 1;
  return { line, col };
}

export function wordBackward(buffer: VimBuffer, cursor: CursorPosition, count: number): CursorPosition {
  let pos = cursor;
  for (let i = 0; i < count; i += 1) pos = stepWordBackward(buffer, pos);
  return pos;
}

/** `e`: 現在(または次)の単語の末尾へ1回分進む。 */
function stepWordEnd(buffer: VimBuffer, pos: CursorPosition): CursorPosition {
  const { lines } = buffer;
  let { line, col } = pos;
  col += 1;

  while (true) {
    if (col >= lines[line].length) {
      if (line === lines.length - 1) return { line, col: Math.max(0, lines[line].length - 1) };
      line += 1;
      col = 0;
      continue;
    }
    if (charClass(lines[line][col]) === "space") {
      col += 1;
      continue;
    }
    const cls = charClass(lines[line][col]);
    while (col + 1 < lines[line].length && charClass(lines[line][col + 1]) === cls) col += 1;
    return { line, col };
  }
}

export function wordEnd(buffer: VimBuffer, cursor: CursorPosition, count: number): CursorPosition {
  let pos = cursor;
  for (let i = 0; i < count; i += 1) pos = stepWordEnd(buffer, pos);
  return pos;
}

/**
 * ノーマルモードのキー1つ(または `gg`)をモーションとして解決する。
 * `count`: `null` は「カウント未指定」を表す(`G`/`gg` の「先頭行/最終行へ」と
 * 「{count}行目へ」の挙動を区別するために必要)。それ以外のモーションでは
 * 未指定時は1回として扱う。
 */
export function resolveMotion(
  key: string,
  buffer: VimBuffer,
  cursor: CursorPosition,
  count: number | null,
): MotionResult | null {
  const repeat = count ?? 1;
  switch (key) {
    case "h":
      return { cursor: moveHorizontal(buffer, cursor, -repeat), kind: "exclusive" };
    case "l":
      return { cursor: moveHorizontal(buffer, cursor, repeat), kind: "exclusive" };
    case "0":
      return { cursor: { line: cursor.line, col: 0 }, kind: "exclusive" };
    case "$":
      return { cursor: { line: cursor.line, col: lastNormalCol(buffer, cursor.line) }, kind: "inclusive" };
    case "j":
      return { cursor: moveVertical(buffer, cursor, repeat), kind: "linewise" };
    case "k":
      return { cursor: moveVertical(buffer, cursor, -repeat), kind: "linewise" };
    case "gg":
      return { cursor: gotoLine(buffer, count ?? 1), kind: "linewise" };
    case "G":
      return { cursor: gotoLine(buffer, count ?? buffer.lines.length), kind: "linewise" };
    case "w":
      return { cursor: wordForward(buffer, cursor, repeat), kind: "exclusive" };
    case "b":
      return { cursor: wordBackward(buffer, cursor, repeat), kind: "exclusive" };
    case "e":
      return { cursor: wordEnd(buffer, cursor, repeat), kind: "inclusive" };
    default:
      return null;
  }
}
