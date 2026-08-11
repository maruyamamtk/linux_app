import { bufferFromFileText, clampCursorNormal } from "./buffer";
import { runExCommand } from "./exCommands";
import { isCursorOnBlank, isMotionKey, resolveMotion } from "./motions";
import {
  applyLinewiseOnCurrentLine,
  applyOperatorMotion,
  deleteCharUnderCursor,
  deleteToEndOfLine,
  pasteAfter,
  pasteBefore,
  pushUndoSnapshot,
  redo,
  undo,
  yankCurrentLines,
} from "./operators";
import { createEmptyPending } from "./types";
import type { CursorPosition, VimBuffer, VimKey, VimState } from "./types";

/** 初期バッファ(ファイル内容、末尾改行あり)からVimStateを作る。 */
export function createInitialState(fileText: string): VimState {
  return {
    mode: "normal",
    buffer: bufferFromFileText(fileText),
    cursor: { line: 0, col: 0 },
    register: { content: "", linewise: false },
    pending: createEmptyPending(),
    commandLine: "",
    statusMessage: null,
    undoStack: [],
    redoStack: [],
    keyLog: [],
  };
}

function clearPending(state: VimState): VimState {
  return { ...state, pending: createEmptyPending() };
}

function withStatus(state: VimState, text: string, isError: boolean): VimState {
  return { ...state, statusMessage: { text, isError } };
}

/**
 * カウントの上限。`w`/`b`/`e` は1回分ずつループするため、桁数の多いカウント入力を
 * そのまま渡すとループ回数が非現実的に巨大(桁数次第では`Infinity`)になり、
 * 画面が固まってしまう。実際の演習で使うバッファはたかだか数十行程度のため、
 * この上限を超えるカウントは意味を持たない。
 */
const MAX_COUNT = 100_000;

/**
 * `pending.count`/`pending.motionCount` から実効カウントを求める。
 * どちらも未入力の場合は「カウント未指定」を表す `null` を返す
 * (`G`/`gg` が「指定なし=先頭/最終行」「指定あり={count}行目」を区別するために必要)。
 */
function effectiveCount(state: VimState): number | null {
  const { count, motionCount } = state.pending;
  if (count === "" && motionCount === "") return null;
  const total = Number(count || "1") * Number(motionCount || "1");
  return Math.min(total, MAX_COUNT);
}

function isDigitForCount(state: VimState, key: string): boolean {
  if (/^[1-9]$/.test(key)) return true;
  // "0" は先頭桁としては行頭移動のモーションであり、カウントの2桁目以降としてのみ数字扱いする
  if (key !== "0") return false;
  return state.pending.operator ? state.pending.motionCount !== "" : state.pending.count !== "";
}

function enterInsertMode(state: VimState, key: string): VimState {
  const pushed = clearPending(pushUndoSnapshot(state));
  const { buffer, cursor } = pushed;
  const line = buffer.lines[cursor.line];

  switch (key) {
    case "i":
      return { ...pushed, mode: "insert" };
    case "a":
      return { ...pushed, mode: "insert", cursor: { line: cursor.line, col: Math.min(cursor.col + 1, line.length) } };
    case "I":
      return { ...pushed, mode: "insert", cursor: { line: cursor.line, col: 0 } };
    case "A":
      return { ...pushed, mode: "insert", cursor: { line: cursor.line, col: line.length } };
    case "o": {
      const lines = [...buffer.lines];
      lines.splice(cursor.line + 1, 0, "");
      return { ...pushed, mode: "insert", buffer: { lines }, cursor: { line: cursor.line + 1, col: 0 } };
    }
    case "O": {
      const lines = [...buffer.lines];
      lines.splice(cursor.line, 0, "");
      return { ...pushed, mode: "insert", buffer: { lines }, cursor: { line: cursor.line, col: 0 } };
    }
    default:
      return pushed;
  }
}

function handleOperatorMotion(state: VimState, key: string): VimState {
  const { operator } = state.pending;
  if (!operator) return state;

  // `cw`はカーソルが非空白上にあるとき、後続の空白を消さないよう`ce`と同じ挙動になる(`:help cw`)。
  const motionKey = operator === "c" && key === "w" && !isCursorOnBlank(state.buffer, state.cursor) ? "e" : key;
  const motion = resolveMotion(motionKey, state.buffer, state.cursor, effectiveCount(state));
  if (!motion) {
    return withStatus(clearPending(state), `未対応の操作です: ${operator}${key}`, true);
  }

  const pushed = pushUndoSnapshot(state);
  const result = applyOperatorMotion(pushed.buffer, pushed.cursor, operator, motion);
  const cleared = clearPending(pushed);

  if (operator === "y") {
    // ヤンクはバッファを変更しないため、積んだundoスナップショットを戻す
    return { ...cleared, undoStack: state.undoStack, cursor: result.cursor, register: result.register };
  }

  return {
    ...cleared,
    buffer: result.buffer,
    cursor: result.cursor,
    register: result.register,
    mode: operator === "c" ? "insert" : "normal",
  };
}

function handleDoubledOperator(state: VimState): VimState {
  const { operator } = state.pending;
  if (!operator) return state;

  const count = effectiveCount(state) ?? 1;
  const pushed = pushUndoSnapshot(state);
  const result = applyLinewiseOnCurrentLine(pushed.buffer, pushed.cursor, operator, count);
  const cleared = clearPending(pushed);

  if (operator === "y") {
    return { ...cleared, undoStack: state.undoStack, cursor: result.cursor, register: result.register };
  }

  return {
    ...cleared,
    buffer: result.buffer,
    cursor: result.cursor,
    register: result.register,
    mode: operator === "c" ? "insert" : "normal",
  };
}

function applyPlainMotion(state: VimState, key: string): VimState {
  const motion = resolveMotion(key, state.buffer, state.cursor, effectiveCount(state));
  if (!motion) return withStatus(clearPending(state), `未対応の操作です: ${key}`, true);
  return { ...clearPending(state), cursor: clampCursorNormal(state.buffer, motion.cursor) };
}

function handleNormalKey(state: VimState, key: string): VimState {
  const { pending } = state;

  // "g" の2打目待ち中は、数字であってもカウント入力として吸収せず g+key の組として扱う
  if (pending.awaitingG) {
    if (key === "g") {
      return pending.operator ? handleOperatorMotion(state, "gg") : applyPlainMotion(state, "gg");
    }
    return withStatus(clearPending(state), `未対応の操作です: g${key}`, true);
  }

  if (isDigitForCount(state, key)) {
    return pending.operator
      ? { ...state, pending: { ...pending, motionCount: pending.motionCount + key } }
      : { ...state, pending: { ...pending, count: pending.count + key } };
  }

  if (key === "g") {
    return { ...state, pending: { ...pending, awaitingG: true } };
  }

  if (pending.operator) {
    if (key === pending.operator) return handleDoubledOperator(state);
    if (isMotionKey(key)) return handleOperatorMotion(state, key);
    return withStatus(clearPending(state), `未対応の操作です: ${pending.operator}${key}`, true);
  }

  switch (key) {
    case "i":
    case "a":
    case "I":
    case "A":
    case "o":
    case "O":
      return enterInsertMode(state, key);
    case ":":
      return { ...clearPending(state), mode: "cmdline", commandLine: "" };
    case "d":
    case "y":
    case "c":
      return { ...state, pending: { ...pending, operator: key } };
    case "x": {
      const pushed = pushUndoSnapshot(state);
      const result = deleteCharUnderCursor(pushed.buffer, pushed.cursor, effectiveCount(state) ?? 1);
      return { ...clearPending(pushed), buffer: result.buffer, cursor: result.cursor, register: result.register };
    }
    case "D": {
      const pushed = pushUndoSnapshot(state);
      const result = deleteToEndOfLine(pushed.buffer, pushed.cursor);
      return { ...clearPending(pushed), buffer: result.buffer, cursor: result.cursor, register: result.register };
    }
    case "Y": {
      const result = yankCurrentLines(state.buffer, state.cursor, effectiveCount(state) ?? 1);
      return { ...clearPending(state), cursor: result.cursor, register: result.register };
    }
    case "p": {
      const pushed = pushUndoSnapshot(state);
      const result = pasteAfter(pushed.buffer, pushed.cursor, pushed.register);
      return { ...clearPending(pushed), buffer: result.buffer, cursor: result.cursor, register: result.register };
    }
    case "P": {
      const pushed = pushUndoSnapshot(state);
      const result = pasteBefore(pushed.buffer, pushed.cursor, pushed.register);
      return { ...clearPending(pushed), buffer: result.buffer, cursor: result.cursor, register: result.register };
    }
    case "u":
      return clearPending(undo(state));
    case "Ctrl-r":
      return clearPending(redo(state));
    case "Escape":
      return clearPending(state);
    default:
      if (isMotionKey(key)) return applyPlainMotion(state, key);
      return withStatus(clearPending(state), `未対応の操作です: ${key}`, true);
  }
}

function insertChar(state: VimState, key: string): VimState {
  const { buffer, cursor } = state;
  const line = buffer.lines[cursor.line];
  const lines = [...buffer.lines];
  lines[cursor.line] = line.slice(0, cursor.col) + key + line.slice(cursor.col);
  const newBuffer: VimBuffer = { lines };
  return { ...state, buffer: newBuffer, cursor: { line: cursor.line, col: cursor.col + key.length } };
}

function backspace(state: VimState): VimState {
  const { buffer, cursor } = state;
  if (cursor.col > 0) {
    const line = buffer.lines[cursor.line];
    const lines = [...buffer.lines];
    lines[cursor.line] = line.slice(0, cursor.col - 1) + line.slice(cursor.col);
    return { ...state, buffer: { lines }, cursor: { line: cursor.line, col: cursor.col - 1 } };
  }
  if (cursor.line === 0) return state;
  const lines = [...buffer.lines];
  const prevLength = lines[cursor.line - 1].length;
  lines[cursor.line - 1] = lines[cursor.line - 1] + lines[cursor.line];
  lines.splice(cursor.line, 1);
  return { ...state, buffer: { lines }, cursor: { line: cursor.line - 1, col: prevLength } };
}

function splitLine(state: VimState): VimState {
  const { buffer, cursor } = state;
  const line = buffer.lines[cursor.line];
  const lines = [...buffer.lines];
  lines.splice(cursor.line, 1, line.slice(0, cursor.col), line.slice(cursor.col));
  return { ...state, buffer: { lines }, cursor: { line: cursor.line + 1, col: 0 } };
}

function handleInsertKey(state: VimState, key: string): VimState {
  if (key === "Escape") {
    const cursor: CursorPosition = { line: state.cursor.line, col: Math.max(0, state.cursor.col - 1) };
    return { ...state, mode: "normal", cursor: clampCursorNormal(state.buffer, cursor) };
  }
  if (key === "Backspace") return backspace(state);
  if (key === "Enter") return splitLine(state);
  if (key.length === 1) return insertChar(state, key);
  return withStatus(state, `未対応のキーです: ${key}`, true);
}

function handleCmdlineKey(state: VimState, key: string): VimState {
  if (key === "Escape") return { ...state, mode: "normal", commandLine: "" };
  if (key === "Enter") return runExCommand(state);
  if (key === "Backspace") {
    if (state.commandLine.length === 0) return { ...state, mode: "normal" };
    return { ...state, commandLine: state.commandLine.slice(0, -1) };
  }
  if (key.length === 1) return { ...state, commandLine: state.commandLine + key };
  return state;
}

/** Vimシミュレータのエントリポイント。1キー入力を受け取り、次のVimStateを返す。 */
export function applyKey(state: VimState, key: VimKey): VimState {
  const base: VimState = { ...state, keyLog: [...state.keyLog, key], statusMessage: null };

  switch (base.mode) {
    case "normal":
      return handleNormalKey(base, key);
    case "insert":
      return handleInsertKey(base, key);
    case "cmdline":
      return handleCmdlineKey(base, key);
  }
}
