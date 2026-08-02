// xargs(1)の簡易実装。標準入力から読み取った項目を引数として組み立て、指定コマンド
// (省略時は`echo`)を実行する。長さ制限(ARG_MAX相当)やインタラクティブ確認(-p)、
// 実行前の表示(-t)といった、シミュレータ上意味を持たないオプションは対象外とする。
import { executeCommand } from "./registry";
import type { CommandHandler, CommandResult } from "./types";

interface XargsOptions {
  /** `-n`。1回の実行に渡す項目数の上限(省略時は全項目を1回で渡す)。 */
  maxArgsPerInvocation?: number;
  /** `-I`。指定時は1項目につき1回実行し、`initialArgs`中のこの文字列を項目で置換する。 */
  replaceStr?: string;
  /** `-d`。項目の区切り文字(省略時は空白文字列で区切る、実xargsと同じ既定動作)。 */
  delimiter?: string;
  /** `-0`。NUL文字区切りで項目を読み取る(`find -print0`との組み合わせ用)。 */
  nullDelimited: boolean;
  commandName: string;
  initialArgs: string[];
}

/** xargs独自のオプション解析。`-n`/`-I`/`-d`は値を取るため、共通の`parseArgs`は使わない。 */
function parseXargsArgs(args: string[]): XargsOptions | { error: string } {
  let maxArgsPerInvocation: number | undefined;
  let replaceStr: string | undefined;
  let delimiter: string | undefined;
  let nullDelimited = false;
  let i = 0;

  const takeValue = (inline: string): string | undefined => {
    if (inline.length > 0) return inline;
    const value = args[i + 1];
    i += 1;
    return value;
  };

  while (i < args.length) {
    const arg = args[i];
    if (arg === "--") {
      i += 1;
      break;
    }
    if (arg.startsWith("-n")) {
      const value = takeValue(arg.slice(2));
      if (value === undefined || Number.isNaN(Number(value)) || Number(value) <= 0) {
        return { error: "xargs: -n オプションには正の整数が必要です" };
      }
      maxArgsPerInvocation = Number(value);
      i += 1;
      continue;
    }
    if (arg.startsWith("-I")) {
      const value = takeValue(arg.slice(2));
      if (value === undefined) return { error: "xargs: -I オプションには置換文字列が必要です" };
      replaceStr = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("-d")) {
      const value = takeValue(arg.slice(2));
      if (value === undefined) return { error: "xargs: -d オプションには区切り文字が必要です" };
      delimiter = value;
      i += 1;
      continue;
    }
    if (arg === "-0") {
      nullDelimited = true;
      i += 1;
      continue;
    }
    if (arg.startsWith("-") && arg.length > 1) {
      // -p(確認)/-t(表示)等、シミュレータ上意味を持たないオプションは無視する。
      i += 1;
      continue;
    }
    break;
  }

  const rest = args.slice(i);
  return {
    maxArgsPerInvocation,
    replaceStr,
    delimiter,
    nullDelimited,
    commandName: rest[0] ?? "echo",
    initialArgs: rest.slice(1),
  };
}

/**
 * xargsの既定の項目分割規則: シングル/ダブルクォートで空白を含む項目を指定でき、
 * バックスラッシュで直後の1文字をエスケープできる(実xargsの引用規則の簡易版)。
 */
function tokenizeWhitespaceSeparated(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let hasCurrent = false;
  let i = 0;

  const flush = (): void => {
    if (hasCurrent) {
      tokens.push(current);
      current = "";
      hasCurrent = false;
    }
  };

  while (i < input.length) {
    const ch = input[i];
    if (ch === " " || ch === "\t" || ch === "\n") {
      flush();
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      hasCurrent = true;
      const quote = ch;
      i += 1;
      while (i < input.length && input[i] !== quote) {
        current += input[i];
        i += 1;
      }
      i += 1; // 閉じクォートを消費する(無い場合はそのままEOFへ達する)
      continue;
    }
    if (ch === "\\" && i + 1 < input.length) {
      hasCurrent = true;
      current += input[i + 1];
      i += 2;
      continue;
    }
    hasCurrent = true;
    current += ch;
    i += 1;
  }
  flush();
  return tokens;
}

/** `-d`/`-0`指定時: 単純に区切り文字列でsplitする(クォート等の解釈は行わない)。 */
function splitByDelimiter(input: string, delimiter: string): string[] {
  if (input === "") return [];
  const parts = input.split(delimiter);
  // 末尾が区切り文字で終わっている場合、split結果の最後に生じる空要素は項目に数えない。
  if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

export const xargsCommand: CommandHandler = (args, context) => {
  const parsed = parseXargsArgs(args);
  if ("error" in parsed) return { stdout: "", stderr: `${parsed.error}\n`, exitCode: 1 };
  const { maxArgsPerInvocation, replaceStr, delimiter, nullDelimited, commandName, initialArgs } = parsed;

  const input = context.stdin ?? "";
  const items = nullDelimited
    ? splitByDelimiter(input, "\0")
    : delimiter !== undefined
      ? splitByDelimiter(input, delimiter)
      : tokenizeWhitespaceSeparated(input);

  if (items.length === 0) return { stdout: "", stderr: "", exitCode: 0 };

  const invocations: string[][] =
    replaceStr !== undefined
      ? items.map((item) => initialArgs.map((arg) => arg.split(replaceStr).join(item)))
      : chunk(items, maxArgsPerInvocation ?? items.length).map((group) => [...initialArgs, ...group]);

  let stdout = "";
  let stderr = "";
  let hadFailure = false;

  for (const invocationArgs of invocations) {
    const result: CommandResult = executeCommand(commandName, invocationArgs, context);
    stdout += result.stdout;
    stderr += result.stderr;
    if (result.exitCode !== 0) hadFailure = true;
  }

  return { stdout, stderr, exitCode: hadFailure ? 123 : 0 };
};
