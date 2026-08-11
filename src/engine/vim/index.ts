export type { CursorPosition, PendingCommand, VimBuffer, VimKey, VimMode, VimRegister, VimState } from "./types";
export { createEmptyPending } from "./types";
export { bufferFromFileText, bufferToFileText } from "./buffer";
export { applyKey, createInitialState } from "./state";
export type { MotionKind, MotionResult } from "./motions";
export { isMotionKey, resolveMotion } from "./motions";
export { parseExCommand, runExCommand } from "./exCommands";
export { VimExCommandError } from "./errors";
