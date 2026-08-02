import { normalizePath } from "../vfs";
import { describeVfsError, fail, ok } from "./errors";
import type { CommandHandler } from "./types";

/**
 * GNU sedはBRE(基本正規表現)がデフォルトのため、`\(` `\)` `\{` `\}` `\|` `\+` `\?` が
 * メタ文字(グループ・量指定子・選択)として働き、逆にエスケープなしの `(` `)` `{` `}` `|` `+` `?`
 * はリテラル文字として扱われる。JSの正規表現(ERE寄り)はこの2つの意味が入れ替わっているため、
 * ここで相互に反転させて `new RegExp` に渡せる形に変換する。
 */
function translateBreToJsRegExp(pattern: string): string {
  const swapped = new Set(["(", ")", "{", "}", "|", "+", "?"]);
  let result = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === "\\" && i + 1 < pattern.length) {
      const next = pattern[i + 1];
      if (swapped.has(next)) {
        result += next;
      } else {
        result += ch + next;
      }
      i += 1;
      continue;
    }
    result += swapped.has(ch) ? `\\${ch}` : ch;
  }
  return result;
}

/** `s///` の置換文字列内の `\1`・`&`・`\&`・`\\` をJSの `String.replace` 向け表記に変換する。 */
function translateReplacement(replacement: string): string {
  let result = "";
  for (let i = 0; i < replacement.length; i += 1) {
    const ch = replacement[i];
    if (ch === "\\" && i + 1 < replacement.length) {
      const next = replacement[i + 1];
      if (/[0-9]/.test(next)) {
        result += `$${next}`;
      } else if (next === "&") {
        result += "&";
      } else if (next === "\\") {
        result += "\\";
      } else {
        result += next;
      }
      i += 1;
      continue;
    }
    if (ch === "&") {
      result += "$&";
      continue;
    }
    if (ch === "$") {
      result += "$$";
      continue;
    }
    result += ch;
  }
  return result;
}

/** 区切り文字(`delim`)でエスケープされていない出現位置まで読み進める。エスケープされた区切り文字はリテラルとして展開する。 */
function readUntilDelimiter(script: string, start: number, delim: string): { text: string; next: number } {
  let result = "";
  let i = start;
  while (i < script.length) {
    const ch = script[i];
    if (ch === "\\" && i + 1 < script.length) {
      const next = script[i + 1];
      if (next === delim) {
        result += delim;
      } else {
        result += ch + next;
      }
      i += 2;
      continue;
    }
    if (ch === delim) {
      return { text: result, next: i + 1 };
    }
    result += ch;
    i += 1;
  }
  throw new Error("unterminated `s' command");
}

type SedAddress =
  | { kind: "line"; line: number }
  | { kind: "last" }
  | { kind: "regex"; regex: RegExp };

interface SedRange {
  start: SedAddress;
  end?: SedAddress;
}

type SedAction =
  | { type: "d" }
  | { type: "p" }
  | { type: "s"; pattern: RegExp; replacement: string };

interface SedInstruction {
  range?: SedRange;
  negate: boolean;
  action: SedAction;
}

function parseAddress(script: string, start: number): { address: SedAddress; next: number } {
  const ch = script[start];
  if (ch === "$") {
    return { address: { kind: "last" }, next: start + 1 };
  }
  if (/[0-9]/.test(ch)) {
    let i = start;
    while (i < script.length && /[0-9]/.test(script[i])) i += 1;
    return { address: { kind: "line", line: Number(script.slice(start, i)) }, next: i };
  }
  if (ch === "/") {
    const { text, next } = readUntilDelimiter(script, start + 1, "/");
    return { address: { kind: "regex", regex: new RegExp(translateBreToJsRegExp(text)) }, next };
  }
  throw new Error(`expected address, got '${ch ?? "EOF"}'`);
}

function skipSpaces(script: string, start: number): number {
  let i = start;
  while (i < script.length && script[i] === " ") i += 1;
  return i;
}

/** `d` `p` `s///[g]`、行番号・`$`・正規表現アドレス(単独/範囲)・`!`(否定)に対応した簡易sedスクリプトパーサ。 */
export function parseSedScript(script: string): SedInstruction[] {
  const instructions: SedInstruction[] = [];
  let i = 0;
  const len = script.length;

  while (true) {
    while (i < len && (script[i] === " " || script[i] === "\t" || script[i] === "\n" || script[i] === ";")) i += 1;
    if (i >= len) break;

    let range: SedRange | undefined;
    if (script[i] === "$" || /[0-9]/.test(script[i]) || script[i] === "/") {
      const first = parseAddress(script, i);
      i = first.next;
      range = { start: first.address };
      i = skipSpaces(script, i);
      if (script[i] === ",") {
        i = skipSpaces(script, i + 1);
        const second = parseAddress(script, i);
        i = second.next;
        range.end = second.address;
      }
    }

    i = skipSpaces(script, i);
    let negate = false;
    if (script[i] === "!") {
      negate = true;
      i = skipSpaces(script, i + 1);
    }

    const commandChar = script[i];
    i += 1;

    if (commandChar === "d" || commandChar === "p") {
      instructions.push({ range, negate, action: { type: commandChar } });
      continue;
    }

    if (commandChar === "s") {
      const delim = script[i];
      i += 1;
      const patternResult = readUntilDelimiter(script, i, delim);
      i = patternResult.next;
      const replacementResult = readUntilDelimiter(script, i, delim);
      i = replacementResult.next;

      let flags = "";
      while (i < len && /[a-zA-Z]/.test(script[i])) {
        flags += script[i];
        i += 1;
      }
      const regexFlags = (flags.includes("g") ? "g" : "") + (flags.includes("i") ? "i" : "");
      instructions.push({
        range,
        negate,
        action: {
          type: "s",
          pattern: new RegExp(translateBreToJsRegExp(patternResult.text), regexFlags),
          replacement: translateReplacement(replacementResult.text),
        },
      });
      continue;
    }

    throw new Error(`unknown command: \`${commandChar ?? "EOF"}'`);
  }

  return instructions;
}

function addressMatches(address: SedAddress, lineNumber: number, totalLines: number, lineText: string): boolean {
  if (address.kind === "line") return lineNumber === address.line;
  if (address.kind === "last") return lineNumber === totalLines;
  return address.regex.test(lineText);
}

interface RangeState {
  active: boolean;
}

function instructionApplies(
  instruction: SedInstruction,
  lineNumber: number,
  totalLines: number,
  lineText: string,
  state: RangeState,
): boolean {
  if (!instruction.range) return true;
  if (!instruction.range.end) {
    return addressMatches(instruction.range.start, lineNumber, totalLines, lineText);
  }

  if (!state.active) {
    if (!addressMatches(instruction.range.start, lineNumber, totalLines, lineText)) return false;
    state.active = true;
    if (addressMatches(instruction.range.end, lineNumber, totalLines, lineText)) state.active = false;
    return true;
  }

  if (addressMatches(instruction.range.end, lineNumber, totalLines, lineText)) state.active = false;
  return true;
}

export function runSed(instructions: SedInstruction[], text: string, suppressAutoprint: boolean): string {
  const hadContent = text.length > 0;
  const trimmed = text.endsWith("\n") ? text.slice(0, -1) : text;
  const lines = hadContent ? trimmed.split("\n") : [];
  const totalLines = lines.length;
  const rangeStates: RangeState[] = instructions.map(() => ({ active: false }));
  const output: string[] = [];

  for (let idx = 0; idx < lines.length; idx += 1) {
    let lineText = lines[idx];
    const lineNumber = idx + 1;
    let deleted = false;

    for (let k = 0; k < instructions.length; k += 1) {
      const instruction = instructions[k];
      let applies = instructionApplies(instruction, lineNumber, totalLines, lineText, rangeStates[k]);
      if (instruction.negate) applies = !applies;
      if (!applies) continue;

      if (instruction.action.type === "d") {
        deleted = true;
        break;
      }
      if (instruction.action.type === "p") {
        output.push(lineText);
        continue;
      }
      lineText = lineText.replace(instruction.action.pattern, instruction.action.replacement);
    }

    if (!deleted && !suppressAutoprint) output.push(lineText);
  }

  return output.length > 0 ? `${output.join("\n")}\n` : "";
}

interface SedInvocation {
  suppressAutoprint: boolean;
  scriptParts: string[];
  files: string[];
}

function parseSedInvocation(args: string[]): SedInvocation {
  const scriptParts: string[] = [];
  const files: string[] = [];
  let suppressAutoprint = false;
  let sawScript = false;
  let i = 0;

  while (i < args.length) {
    const arg = args[i];
    if (arg === "-n" || arg === "--quiet" || arg === "--silent") {
      suppressAutoprint = true;
      i += 1;
      continue;
    }
    if (arg === "-e") {
      scriptParts.push(args[i + 1] ?? "");
      sawScript = true;
      i += 2;
      continue;
    }
    if (!sawScript) {
      scriptParts.push(arg);
      sawScript = true;
      i += 1;
      continue;
    }
    files.push(arg);
    i += 1;
  }

  return { suppressAutoprint, scriptParts, files };
}

export const sedCommand: CommandHandler = (args, context) => {
  const { suppressAutoprint, scriptParts, files } = parseSedInvocation(args);
  if (scriptParts.length === 0) return fail("sed: no script specified");
  if (files.length === 0) return fail("sed: missing file operand");

  let instructions: SedInstruction[];
  try {
    instructions = parseSedScript(scriptParts.join("\n"));
  } catch (error) {
    return fail(`sed: -e expression: ${error instanceof Error ? error.message : String(error)}`);
  }

  const contents: string[] = [];
  for (const file of files) {
    const resolved = normalizePath(file, context.cwd);
    try {
      if (context.vfs.stat(resolved).type === "directory") {
        return fail(`sed: read error on ${file}: Is a directory`);
      }
      contents.push(context.vfs.readFile(resolved));
    } catch (error) {
      return fail(describeVfsError("sed", file, error, "can't read"));
    }
  }

  try {
    return ok(runSed(instructions, contents.join(""), suppressAutoprint));
  } catch (error) {
    return fail(`sed: ${error instanceof Error ? error.message : String(error)}`);
  }
};
