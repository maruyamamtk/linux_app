import {
  bufferToText,
  clampCursorInsert,
  clampCursorNormal,
  offsetToPosition,
  positionToOffset,
  textToBuffer,
} from "./buffer";
import type { MotionResult } from "./motions";
import type { CursorPosition, VimBuffer, VimRegister, VimState } from "./types";

export interface EditOutcome {
  buffer: VimBuffer;
  cursor: CursorPosition;
  register: VimRegister;
}

function charwiseRange(
  buffer: VimBuffer,
  from: CursorPosition,
  motion: MotionResult,
): { start: number; end: number } {
  const a = positionToOffset(buffer, from);
  const b = positionToOffset(buffer, motion.cursor);
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return { start: lo, end: motion.kind === "inclusive" ? hi + 1 : hi };
}

function applyCharwise(
  buffer: VimBuffer,
  cursor: CursorPosition,
  motion: MotionResult,
  operator: "d" | "y" | "c",
): EditOutcome {
  const text = bufferToText(buffer);
  const { start, end } = charwiseRange(buffer, cursor, motion);
  const register: VimRegister = { content: text.slice(start, end), linewise: false };

  if (operator === "y") {
    return { buffer, cursor: clampCursorNormal(buffer, offsetToPosition(buffer, start)), register };
  }

  const newBuffer = textToBuffer(text.slice(0, start) + text.slice(end));
  const rawCursor = offsetToPosition(newBuffer, start);
  const cursor2 =
    operator === "c" ? clampCursorInsert(newBuffer, rawCursor) : clampCursorNormal(newBuffer, rawCursor);
  return { buffer: newBuffer, cursor: cursor2, register };
}

function applyLinewise(
  buffer: VimBuffer,
  cursor: CursorPosition,
  targetLine: number,
  operator: "d" | "y" | "c",
): EditOutcome {
  const loLine = Math.min(cursor.line, targetLine);
  const hiLine = Math.max(cursor.line, targetLine);
  const register: VimRegister = {
    content: `${buffer.lines.slice(loLine, hiLine + 1).join("\n")}\n`,
    linewise: true,
  };

  if (operator === "y") {
    return { buffer, cursor: { line: loLine, col: 0 }, register };
  }

  const lines = [...buffer.lines];
  lines.splice(loLine, hiLine - loLine + 1, ...(operator === "c" ? [""] : []));
  const newBuffer: VimBuffer = { lines: lines.length === 0 ? [""] : lines };
  const newLine = Math.min(loLine, newBuffer.lines.length - 1);
  const target = { line: newLine, col: 0 };
  const cursor2 = operator === "c" ? clampCursorInsert(newBuffer, target) : clampCursorNormal(newBuffer, target);
  return { buffer: newBuffer, cursor: cursor2, register };
}

/** `d`/`y`/`c` + モーション(`w`/`b`/`e`/`h`/`l`/`0`/`$`/`j`/`k`/`gg`/`G`)を適用する。 */
export function applyOperatorMotion(
  buffer: VimBuffer,
  cursor: CursorPosition,
  operator: "d" | "y" | "c",
  motion: MotionResult,
): EditOutcome {
  if (motion.kind === "linewise") {
    return applyLinewise(buffer, cursor, motion.cursor.line, operator);
  }
  return applyCharwise(buffer, cursor, motion, operator);
}

/** `dd`/`yy`/`cc`(オペレータの2打目としてのdd/yy/cc)。現在行から`count`行を対象にする。 */
export function applyLinewiseOnCurrentLine(
  buffer: VimBuffer,
  cursor: CursorPosition,
  operator: "d" | "y" | "c",
  count: number,
): EditOutcome {
  const targetLine = Math.min(buffer.lines.length - 1, cursor.line + count - 1);
  return applyLinewise(buffer, cursor, targetLine, operator);
}

/** `x`(`dl`の糖衣): カーソル位置から`count`文字を削除する。 */
export function deleteCharUnderCursor(buffer: VimBuffer, cursor: CursorPosition, count: number): EditOutcome {
  const line = buffer.lines[cursor.line];
  const end = Math.min(line.length, cursor.col + count);
  if (end === cursor.col) {
    return { buffer, cursor, register: { content: "", linewise: false } };
  }
  const lines = [...buffer.lines];
  lines[cursor.line] = line.slice(0, cursor.col) + line.slice(end);
  const newBuffer: VimBuffer = { lines };
  return {
    buffer: newBuffer,
    cursor: clampCursorNormal(newBuffer, cursor),
    register: { content: line.slice(cursor.col, end), linewise: false },
  };
}

/** `D`(`d$`の糖衣): カーソル位置から行末まで削除する。 */
export function deleteToEndOfLine(buffer: VimBuffer, cursor: CursorPosition): EditOutcome {
  const line = buffer.lines[cursor.line];
  const lines = [...buffer.lines];
  lines[cursor.line] = line.slice(0, cursor.col);
  const newBuffer: VimBuffer = { lines };
  return {
    buffer: newBuffer,
    cursor: clampCursorNormal(newBuffer, cursor),
    register: { content: line.slice(cursor.col), linewise: false },
  };
}

/** `Y`(`yy`の糖衣)。 */
export function yankCurrentLines(buffer: VimBuffer, cursor: CursorPosition, count: number): EditOutcome {
  const targetLine = Math.min(buffer.lines.length - 1, cursor.line + count - 1);
  return applyLinewise(buffer, cursor, targetLine, "y");
}

function insertCharwise(
  buffer: VimBuffer,
  at: CursorPosition,
  content: string,
): { buffer: VimBuffer; cursor: CursorPosition } {
  const offset = positionToOffset(buffer, at);
  const text = bufferToText(buffer);
  const newBuffer = textToBuffer(text.slice(0, offset) + content + text.slice(offset));
  const cursor = clampCursorNormal(newBuffer, offsetToPosition(newBuffer, offset + content.length - 1));
  return { buffer: newBuffer, cursor };
}

function pasteLinewise(buffer: VimBuffer, insertAtLine: number, register: VimRegister): EditOutcome {
  const pasted = register.content.endsWith("\n") ? register.content.slice(0, -1) : register.content;
  const lines = [...buffer.lines];
  lines.splice(insertAtLine, 0, ...pasted.split("\n"));
  const newBuffer: VimBuffer = { lines };
  return { buffer: newBuffer, cursor: clampCursorNormal(newBuffer, { line: insertAtLine, col: 0 }), register };
}

/** `p`: レジスタの内容をカーソルの後ろ(行単位なら次行)に貼り付ける。 */
export function pasteAfter(buffer: VimBuffer, cursor: CursorPosition, register: VimRegister): EditOutcome {
  if (register.content === "") return { buffer, cursor, register };
  if (register.linewise) return pasteLinewise(buffer, cursor.line + 1, register);
  const insertCol = Math.min(cursor.col + 1, buffer.lines[cursor.line].length);
  const { buffer: newBuffer, cursor: newCursor } = insertCharwise(buffer, { line: cursor.line, col: insertCol }, register.content);
  return { buffer: newBuffer, cursor: newCursor, register };
}

/** `P`: レジスタの内容をカーソルの前(行単位なら前行)に貼り付ける。 */
export function pasteBefore(buffer: VimBuffer, cursor: CursorPosition, register: VimRegister): EditOutcome {
  if (register.content === "") return { buffer, cursor, register };
  if (register.linewise) return pasteLinewise(buffer, cursor.line, register);
  const { buffer: newBuffer, cursor: newCursor } = insertCharwise(buffer, cursor, register.content);
  return { buffer: newBuffer, cursor: newCursor, register };
}

/** 破壊的操作の直前に呼び、undoスタックへ現在のバッファを積む(redoスタックはクリア)。 */
export function pushUndoSnapshot(state: VimState): VimState {
  return { ...state, undoStack: [...state.undoStack, state.buffer], redoStack: [] };
}

/** `u`: 直前のundoスナップショットへ戻す。 */
export function undo(state: VimState): VimState {
  if (state.undoStack.length === 0) {
    return { ...state, statusMessage: { text: "これ以上元に戻せません", isError: true } };
  }
  const previous = state.undoStack[state.undoStack.length - 1];
  return {
    ...state,
    buffer: previous,
    cursor: clampCursorNormal(previous, state.cursor),
    undoStack: state.undoStack.slice(0, -1),
    redoStack: [...state.redoStack, state.buffer],
    statusMessage: null,
  };
}

/** `Ctrl-r`: undoを取り消してやり直す。 */
export function redo(state: VimState): VimState {
  if (state.redoStack.length === 0) {
    return { ...state, statusMessage: { text: "これ以上やり直せません", isError: true } };
  }
  const next = state.redoStack[state.redoStack.length - 1];
  return {
    ...state,
    buffer: next,
    cursor: clampCursorNormal(next, state.cursor),
    undoStack: [...state.undoStack, state.buffer],
    redoStack: state.redoStack.slice(0, -1),
    statusMessage: null,
  };
}
