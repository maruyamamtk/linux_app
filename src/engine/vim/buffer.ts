import type { CursorPosition, VimBuffer } from "./types";

/** バッファを "\n" 区切りの1つの文字列に変換する(行をまたぐ範囲操作をオフセット計算で扱うため)。 */
export function bufferToText(buffer: VimBuffer): string {
  return buffer.lines.join("\n");
}

/** `bufferToText` の逆変換。`"".split("\n")` は `[""]` を返すため空文字列でも1行のバッファになる。 */
export function textToBuffer(text: string): VimBuffer {
  return { lines: text.split("\n") };
}

/** カーソル位置をバッファ全体を1つの文字列とみなした場合の0-indexedオフセットに変換する。 */
export function positionToOffset(buffer: VimBuffer, pos: CursorPosition): number {
  let offset = 0;
  for (let i = 0; i < pos.line; i += 1) {
    offset += buffer.lines[i].length + 1;
  }
  return offset + pos.col;
}

/** `positionToOffset` の逆変換。範囲外のオフセットはバッファ末尾にクランプする。 */
export function offsetToPosition(buffer: VimBuffer, offset: number): CursorPosition {
  let remaining = offset;
  for (let line = 0; line < buffer.lines.length; line += 1) {
    const len = buffer.lines[line].length;
    if (remaining <= len) {
      return { line, col: remaining };
    }
    remaining -= len + 1;
  }
  const lastLine = buffer.lines.length - 1;
  return { line: lastLine, col: buffer.lines[lastLine].length };
}

/** 指定行の最終列(ノーマルモードの制約: 行末の改行位置にはカーソルが乗らない)。 */
export function lastNormalCol(buffer: VimBuffer, line: number): number {
  return Math.max(0, buffer.lines[line].length - 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** ノーマルモードの制約(`col <= max(0, len-1)`)に沿ってカーソル位置をクランプする。 */
export function clampCursorNormal(buffer: VimBuffer, pos: CursorPosition): CursorPosition {
  const line = clamp(pos.line, 0, buffer.lines.length - 1);
  const col = clamp(pos.col, 0, lastNormalCol(buffer, line));
  return { line, col };
}

/** インサートモードの制約(`col <= len`、行末への挿入を許可)に沿ってカーソル位置をクランプする。 */
export function clampCursorInsert(buffer: VimBuffer, pos: CursorPosition): CursorPosition {
  const line = clamp(pos.line, 0, buffer.lines.length - 1);
  const col = clamp(pos.col, 0, buffer.lines[line].length);
  return { line, col };
}

/** ファイル内容(末尾改行あり)からバッファを作る。VFSの一般的なテキストファイル表現からの変換用。 */
export function bufferFromFileText(text: string): VimBuffer {
  const withoutTrailingNewline = text.endsWith("\n") ? text.slice(0, -1) : text;
  return textToBuffer(withoutTrailingNewline);
}

/** バッファをファイル内容(末尾改行あり)に変換する。採点時の比較・`:w` 相当の書き出しに使う。 */
export function bufferToFileText(buffer: VimBuffer): string {
  return `${bufferToText(buffer)}\n`;
}
