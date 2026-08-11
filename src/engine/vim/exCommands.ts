import { readUntilDelimiter, translateBreToJsRegExp, translateReplacement } from "../commands/sed";
import { clampCursorNormal } from "./buffer";
import { VimExCommandError } from "./errors";
import { pushUndoSnapshot } from "./operators";
import type { VimBuffer, VimState } from "./types";

type ExAddress = number | "last";

interface ExRange {
  start: ExAddress;
  end: ExAddress;
}

type ExCommand =
  | { type: "goto"; line: number }
  | { type: "substitute"; range?: ExRange; regex: RegExp; replacement: string; patternSource: string }
  | { type: "write" }
  | { type: "quit" }
  | { type: "writequit" };

function parseAddress(input: string, start: number): { address: ExAddress; next: number } {
  if (input[start] === "$") return { address: "last", next: start + 1 };
  if (/[0-9]/.test(input[start])) {
    let i = start;
    while (i < input.length && /[0-9]/.test(input[i])) i += 1;
    return { address: Number(input.slice(start, i)), next: i };
  }
  throw new VimExCommandError(`不正なアドレスです: ${input.slice(start)}`);
}

/** `:` 以降の入力文字列(先頭の `:` は含まない)を解析する。 */
export function parseExCommand(input: string): ExCommand {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new VimExCommandError("コマンドが指定されていません");
  }

  if (/^\d+$/.test(trimmed)) {
    return { type: "goto", line: Number(trimmed) };
  }

  let i = 0;
  let range: ExRange | undefined;
  if (trimmed[i] === "%") {
    range = { start: 1, end: "last" };
    i += 1;
  } else if (trimmed[i] === "$" || /[0-9]/.test(trimmed[i])) {
    const first = parseAddress(trimmed, i);
    i = first.next;
    if (trimmed[i] === ",") {
      const second = parseAddress(trimmed, i + 1);
      i = second.next;
      range = { start: first.address, end: second.address };
    } else {
      range = { start: first.address, end: first.address };
    }
  }

  const rest = trimmed.slice(i);
  if (rest === "w") return { type: "write" };
  if (rest === "q") return { type: "quit" };
  if (rest === "wq") return { type: "writequit" };

  if (rest.startsWith("s")) {
    const delim = rest[1];
    if (!delim) throw new VimExCommandError(`不正な s コマンドです: ${trimmed}`);
    const patternResult = readUntilDelimiter(rest, 2, delim);
    const replacementResult = readUntilDelimiter(rest, patternResult.next, delim);
    const flags = rest.slice(replacementResult.next);
    if (!/^[gi]*$/.test(flags)) {
      throw new VimExCommandError(`未対応のフラグです: ${flags}`);
    }
    const regexFlags = (flags.includes("g") ? "g" : "") + (flags.includes("i") ? "i" : "");
    return {
      type: "substitute",
      range,
      regex: new RegExp(translateBreToJsRegExp(patternResult.text), regexFlags),
      replacement: translateReplacement(replacementResult.text),
      patternSource: patternResult.text,
    };
  }

  throw new VimExCommandError(`未対応のコマンドです: ${trimmed}`);
}

function resolveAddress(address: ExAddress, buffer: VimBuffer): number {
  const line = address === "last" ? buffer.lines.length : address;
  if (line < 1 || line > buffer.lines.length) {
    throw new VimExCommandError(`指定範囲外です: ${address}`);
  }
  return line - 1;
}

function resolveRange(range: ExRange | undefined, buffer: VimBuffer, currentLine: number): { start: number; end: number } {
  if (!range) return { start: currentLine, end: currentLine };
  return { start: resolveAddress(range.start, buffer), end: resolveAddress(range.end, buffer) };
}

function withMessage(state: VimState, text: string, isError: boolean): VimState {
  return { ...state, mode: "normal", commandLine: "", statusMessage: { text, isError } };
}

/** コマンドラインモードで確定した入力(`state.commandLine`)を実行する。 */
export function runExCommand(state: VimState): VimState {
  let command: ExCommand;
  try {
    command = parseExCommand(state.commandLine);
  } catch (error) {
    const message = error instanceof VimExCommandError ? error.message : String(error);
    return withMessage(state, message, true);
  }

  switch (command.type) {
    case "goto": {
      try {
        const line = resolveAddress(command.line, state.buffer);
        return {
          ...state,
          mode: "normal",
          commandLine: "",
          statusMessage: null,
          cursor: clampCursorNormal(state.buffer, { line, col: 0 }),
        };
      } catch (error) {
        const message = error instanceof VimExCommandError ? error.message : String(error);
        return withMessage(state, message, true);
      }
    }
    case "substitute": {
      let start: number;
      let end: number;
      try {
        ({ start, end } = resolveRange(command.range, state.buffer, state.cursor.line));
      } catch (error) {
        const message = error instanceof VimExCommandError ? error.message : String(error);
        return withMessage(state, message, true);
      }

      const lines = [...state.buffer.lines];
      let matched = false;
      for (let lineIndex = start; lineIndex <= end; lineIndex += 1) {
        const replaced = lines[lineIndex].replace(command.regex, command.replacement);
        if (replaced !== lines[lineIndex]) matched = true;
        lines[lineIndex] = replaced;
      }

      if (!matched) {
        return withMessage(state, `パターンが見つかりません: ${command.patternSource}`, true);
      }

      const pushed = pushUndoSnapshot(state);
      const buffer: VimBuffer = { lines };
      return {
        ...pushed,
        mode: "normal",
        commandLine: "",
        statusMessage: null,
        buffer,
        cursor: clampCursorNormal(buffer, { line: end, col: 0 }),
      };
    }
    case "write":
      return withMessage(state, "書き込みました", false);
    case "quit":
      return withMessage(state, "終了します", false);
    case "writequit":
      return withMessage(state, "書き込んで終了します", false);
  }
}
