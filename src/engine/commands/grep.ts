import { normalizePath } from "../vfs";
import { compileRegex, RegexSyntaxError, type CompiledPattern } from "../regex";
import { parseArgs } from "./args";
import { describeVfsError, fail } from "./errors";
import type { CommandContext, CommandHandler } from "./types";

function resolveArgPath(context: CommandContext, path: string): string {
  return normalizePath(path, context.cwd);
}

/** 末尾の改行有無に関わらず、ファイル内容を行の配列に分割する。 */
function splitLines(content: string): string[] {
  if (content === "") return [];
  const lines = content.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export const grepCommand: CommandHandler = (args, context) => {
  const { flags, positional } = parseArgs(args);
  if (positional.length === 0) return fail("usage: grep [-inv] [-E] pattern [file...]", 2);

  const [pattern, ...files] = positional;
  if (files.length === 0) return fail("grep: missing file operand", 2);

  const ignoreCase = flags.has("i") || flags.has("ignore-case");
  const showLineNumbers = flags.has("n") || flags.has("line-number");
  const invert = flags.has("v") || flags.has("invert-match");
  const extended = flags.has("E") || flags.has("extended-regexp");

  let regex: CompiledPattern;
  try {
    regex = compileRegex(pattern, { extended, ignoreCase });
  } catch (error) {
    if (error instanceof RegexSyntaxError) return fail(`grep: ${error.message}`, 2);
    throw error;
  }

  const showFileNames = files.length > 1;
  const outputLines: string[] = [];
  const errors: string[] = [];
  let matchedAny = false;

  for (const file of files) {
    const resolved = resolveArgPath(context, file);
    let content: string;
    try {
      content = context.vfs.readFile(resolved);
    } catch (error) {
      errors.push(describeVfsError("grep", file, error));
      continue;
    }

    splitLines(content).forEach((line, index) => {
      if (regex.test(line) === invert) return;
      matchedAny = true;

      const prefixParts = [
        showFileNames ? file : undefined,
        showLineNumbers ? String(index + 1) : undefined,
      ].filter((part): part is string => part !== undefined);
      const prefix = prefixParts.length > 0 ? `${prefixParts.join(":")}:` : "";
      outputLines.push(`${prefix}${line}`);
    });
  }

  return {
    stdout: outputLines.length > 0 ? `${outputLines.join("\n")}\n` : "",
    stderr: errors.length > 0 ? `${errors.join("\n")}\n` : "",
    exitCode: errors.length > 0 ? 2 : matchedAny ? 0 : 1,
  };
};
