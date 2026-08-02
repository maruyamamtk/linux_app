import { normalizePath } from "../vfs";
import { parseArgs } from "./args";
import { describeVfsError, fail, ok } from "./errors";
import type { CommandContext, CommandHandler } from "./types";

function resolveArgPath(context: CommandContext, path: string): string {
  return normalizePath(path, context.cwd);
}

/** 末尾の改行だけを取り除いてから行配列に分割する(空文字列は行0件として扱う)。 */
function toLines(text: string): string[] {
  return text.length > 0 ? text.replace(/\n$/, "").split("\n") : [];
}

// ---------------------------------------------------------------------------
// wc
// ---------------------------------------------------------------------------

interface WcCounts {
  lines: number;
  words: number;
  bytes: number;
}

function countText(text: string): WcCounts {
  const lines = (text.match(/\n/g) ?? []).length;
  const words = text.split(/\s+/).filter((word) => word.length > 0).length;
  return { lines, words, bytes: text.length };
}

function addCounts(a: WcCounts, b: WcCounts): WcCounts {
  return { lines: a.lines + b.lines, words: a.words + b.words, bytes: a.bytes + b.bytes };
}

function formatWcLine(counts: WcCounts, flags: Set<string>, label?: string): string {
  const showAll = !flags.has("l") && !flags.has("w") && !flags.has("c");
  const fields: string[] = [];
  if (showAll || flags.has("l")) fields.push(String(counts.lines).padStart(7));
  if (showAll || flags.has("w")) fields.push(String(counts.words).padStart(7));
  if (showAll || flags.has("c")) fields.push(String(counts.bytes).padStart(7));
  return label !== undefined ? `${fields.join("")} ${label}` : fields.join("");
}

export const wcCommand: CommandHandler = (args, context) => {
  const { flags, positional } = parseArgs(args);

  if (positional.length === 0) {
    const counts = countText(context.stdin ?? "");
    return ok(`${formatWcLine(counts, flags)}\n`);
  }

  const lines: string[] = [];
  const errors: string[] = [];
  let total: WcCounts = { lines: 0, words: 0, bytes: 0 };

  for (const target of positional) {
    const resolved = resolveArgPath(context, target);
    try {
      const stat = context.vfs.stat(resolved);
      if (stat.type === "directory") {
        errors.push(`wc: ${target}: Is a directory`);
        continue;
      }
      const counts = countText(context.vfs.readFile(resolved));
      total = addCounts(total, counts);
      lines.push(formatWcLine(counts, flags, target));
    } catch (error) {
      errors.push(describeVfsError("wc", target, error));
    }
  }

  if (positional.length > 1) lines.push(formatWcLine(total, flags, "total"));

  return {
    stdout: lines.length > 0 ? `${lines.join("\n")}\n` : "",
    stderr: errors.length > 0 ? `${errors.join("\n")}\n` : "",
    exitCode: errors.length > 0 ? 1 : 0,
  };
};

// ---------------------------------------------------------------------------
// sort
// ---------------------------------------------------------------------------

interface SortOptions {
  numeric: boolean;
  reverse: boolean;
  unique: boolean;
  key?: number;
  files: string[];
}

function parseSortArgs(args: string[]): SortOptions {
  const options: SortOptions = { numeric: false, reverse: false, unique: false, files: [] };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "-k" || arg === "--key") {
      options.key = Number(args[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith("-k") && arg.length > 2) {
      options.key = Number(arg.slice(2));
      continue;
    }
    if (arg.startsWith("--") && arg.length > 2) {
      if (arg === "--numeric-sort") options.numeric = true;
      else if (arg === "--reverse") options.reverse = true;
      else if (arg === "--unique") options.unique = true;
      continue;
    }
    if (arg.startsWith("-") && arg.length > 1) {
      for (const ch of arg.slice(1)) {
        if (ch === "n") options.numeric = true;
        else if (ch === "r") options.reverse = true;
        else if (ch === "u") options.unique = true;
      }
      continue;
    }
    options.files.push(arg);
  }

  return options;
}

function extractSortKey(line: string, key?: number): string {
  if (!key) return line;
  const fields = line.trim().split(/\s+/);
  return fields[key - 1] ?? "";
}

function compareLines(a: string, b: string, options: SortOptions): number {
  const aKey = extractSortKey(a, options.key);
  const bKey = extractSortKey(b, options.key);
  const result = options.numeric
    ? (Number.parseFloat(aKey) || 0) - (Number.parseFloat(bKey) || 0)
    : aKey < bKey
      ? -1
      : aKey > bKey
        ? 1
        : 0;
  return options.reverse ? -result : result;
}

export const sortCommand: CommandHandler = (args, context) => {
  const options = parseSortArgs(args);
  const errors: string[] = [];
  let lines: string[];

  if (options.files.length === 0) {
    lines = toLines(context.stdin ?? "");
  } else {
    lines = [];
    for (const target of options.files) {
      const resolved = resolveArgPath(context, target);
      try {
        lines.push(...toLines(context.vfs.readFile(resolved)));
      } catch (error) {
        errors.push(describeVfsError("sort", target, error));
      }
    }
  }

  lines = [...lines].sort((a, b) => compareLines(a, b, options));

  if (options.unique) {
    const seen = new Set<string>();
    lines = lines.filter((line) => {
      const key = extractSortKey(line, options.key);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return {
    stdout: lines.length > 0 ? `${lines.join("\n")}\n` : "",
    stderr: errors.length > 0 ? `${errors.join("\n")}\n` : "",
    exitCode: errors.length > 0 ? 1 : 0,
  };
};

// ---------------------------------------------------------------------------
// uniq
// ---------------------------------------------------------------------------

export const uniqCommand: CommandHandler = (args, context) => {
  const { flags, positional } = parseArgs(args);
  const showCount = flags.has("c") || flags.has("count");

  let text: string;
  if (positional.length === 0) {
    text = context.stdin ?? "";
  } else {
    const target = positional[0];
    try {
      text = context.vfs.readFile(resolveArgPath(context, target));
    } catch (error) {
      return fail(describeVfsError("uniq", target, error));
    }
  }

  const grouped: { line: string; count: number }[] = [];
  for (const line of toLines(text)) {
    const last = grouped[grouped.length - 1];
    if (last && last.line === line) {
      last.count += 1;
    } else {
      grouped.push({ line, count: 1 });
    }
  }

  const output = grouped
    .map((entry) => (showCount ? `${String(entry.count).padStart(7)} ${entry.line}` : entry.line))
    .join("\n");

  return ok(output.length > 0 ? `${output}\n` : "");
};

// ---------------------------------------------------------------------------
// cut
// ---------------------------------------------------------------------------

interface FieldRange {
  start: number;
  end: number;
}

function parseFieldRanges(spec: string): FieldRange[] {
  return spec.split(",").map((part) => {
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-");
      const start = startStr ? Number(startStr) : 1;
      const end = endStr ? Number(endStr) : Number.MAX_SAFE_INTEGER;
      return { start, end };
    }
    const field = Number(part);
    return { start: field, end: field };
  });
}

function selectFields(fields: string[], ranges: FieldRange[]): string[] {
  return fields.filter((_field, index) => ranges.some((range) => index + 1 >= range.start && index + 1 <= range.end));
}

interface CutOptions {
  delimiter: string;
  fieldSpec?: string;
  files: string[];
}

function parseCutArgs(args: string[]): CutOptions {
  const options: CutOptions = { delimiter: "\t", files: [] };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "-d" || arg === "--delimiter") {
      options.delimiter = args[i + 1] ?? options.delimiter;
      i += 1;
      continue;
    }
    if (arg.startsWith("-d") && arg.length > 2) {
      options.delimiter = arg.slice(2);
      continue;
    }
    if (arg.startsWith("--delimiter=")) {
      options.delimiter = arg.slice("--delimiter=".length);
      continue;
    }
    if (arg === "-f" || arg === "--fields") {
      options.fieldSpec = args[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith("-f") && arg.length > 2) {
      options.fieldSpec = arg.slice(2);
      continue;
    }
    if (arg.startsWith("--fields=")) {
      options.fieldSpec = arg.slice("--fields=".length);
      continue;
    }
    options.files.push(arg);
  }

  return options;
}

export const cutCommand: CommandHandler = (args, context) => {
  const options = parseCutArgs(args);
  if (!options.fieldSpec) return fail("cut: you must specify a list of fields");
  const ranges = parseFieldRanges(options.fieldSpec);

  const process = (text: string): string =>
    toLines(text)
      .map((line) => selectFields(line.split(options.delimiter), ranges).join(options.delimiter))
      .join("\n");

  if (options.files.length === 0) {
    const output = process(context.stdin ?? "");
    return ok(output.length > 0 ? `${output}\n` : "");
  }

  const outputs: string[] = [];
  const errors: string[] = [];
  for (const target of options.files) {
    try {
      outputs.push(process(context.vfs.readFile(resolveArgPath(context, target))));
    } catch (error) {
      errors.push(describeVfsError("cut", target, error));
    }
  }

  const stdout = outputs.filter((output) => output.length > 0).join("\n");
  return {
    stdout: stdout.length > 0 ? `${stdout}\n` : "",
    stderr: errors.length > 0 ? `${errors.join("\n")}\n` : "",
    exitCode: errors.length > 0 ? 1 : 0,
  };
};

// ---------------------------------------------------------------------------
// tr
// ---------------------------------------------------------------------------

/** `a-z` のような範囲指定を含む文字集合を、個々の文字の配列へ展開する。 */
function expandCharSet(set: string): string[] {
  const chars: string[] = [];
  for (let i = 0; i < set.length; i += 1) {
    if (set[i + 1] === "-" && i + 2 < set.length) {
      const start = set.charCodeAt(i);
      const end = set.charCodeAt(i + 2);
      for (let code = start; code <= end; code += 1) chars.push(String.fromCharCode(code));
      i += 2;
    } else {
      chars.push(set[i]);
    }
  }
  return chars;
}

/** `tr` はパイプ経由の標準入力のみを扱う実際のcoreutilsと同様、ファイル引数を取らない。 */
export const trCommand: CommandHandler = (args, context) => {
  const { flags, positional } = parseArgs(args);
  const deleteMode = flags.has("d") || flags.has("delete");
  const input = context.stdin ?? "";

  if (deleteMode) {
    if (positional.length === 0) return fail("tr: missing operand");
    const deleteSet = new Set(expandCharSet(positional[0]));
    return ok(
      Array.from(input)
        .filter((ch) => !deleteSet.has(ch))
        .join(""),
    );
  }

  if (positional.length < 2) return fail("tr: missing operand");
  const fromSet = expandCharSet(positional[0]);
  const toSet = expandCharSet(positional[1]);
  const translation = new Map<string, string>();
  fromSet.forEach((ch, index) => {
    translation.set(ch, toSet[index] ?? toSet[toSet.length - 1] ?? ch);
  });

  return ok(
    Array.from(input)
      .map((ch) => translation.get(ch) ?? ch)
      .join(""),
  );
};

// ---------------------------------------------------------------------------
// head / tail
// ---------------------------------------------------------------------------

interface LineCountOptions {
  count: number;
  follow: boolean;
  files: string[];
}

function parseLineCountArgs(args: string[]): LineCountOptions {
  const options: LineCountOptions = { count: 10, follow: false, files: [] };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "-n" || arg === "--lines") {
      options.count = Number(args[i + 1]) || options.count;
      i += 1;
      continue;
    }
    if (arg.startsWith("-n") && arg.length > 2) {
      options.count = Number(arg.slice(2)) || options.count;
      continue;
    }
    if (arg === "-f" || arg === "--follow") {
      options.follow = true;
      continue;
    }
    if (/^-\d+$/.test(arg)) {
      options.count = Number(arg.slice(1));
      continue;
    }
    options.files.push(arg);
  }

  return options;
}

function buildHeadTailResult(
  command: "head" | "tail",
  options: LineCountOptions,
  context: CommandContext,
  select: (lines: string[], count: number) => string[],
): ReturnType<CommandHandler> {
  if (options.files.length === 0) {
    const lines = select(toLines(context.stdin ?? ""), options.count);
    return ok(lines.length > 0 ? `${lines.join("\n")}\n` : "");
  }

  const sections: string[] = [];
  const errors: string[] = [];
  for (const target of options.files) {
    const resolved = normalizePath(target, context.cwd);
    try {
      const lines = select(toLines(context.vfs.readFile(resolved)), options.count);
      sections.push(options.files.length > 1 ? `==> ${target} <==\n${lines.join("\n")}` : lines.join("\n"));
    } catch (error) {
      errors.push(describeVfsError(command, target, error));
    }
  }

  const stdout = sections.join("\n\n");
  return {
    stdout: stdout.length > 0 ? `${stdout}\n` : "",
    stderr: errors.length > 0 ? `${errors.join("\n")}\n` : "",
    exitCode: errors.length > 0 ? 1 : 0,
  };
}

export const headCommand: CommandHandler = (args, context) => {
  const options = parseLineCountArgs(args);
  return buildHeadTailResult("head", options, context, (lines, count) =>
    count > 0 ? lines.slice(0, count) : [],
  );
};

/**
 * `-f` は追記の継続監視を意味するが、`CommandHandler` はコマンド1回の実行に対して
 * 同期的に結果を1度返す設計になっており、シェル側にもストリーミング実行の仕組みが
 * 無いため、真の「追記の都度出力する」挙動は再現できない。ここでは実行時点の末尾
 * 内容を返すことで簡易的にシミュレートする(エラーにはしない)。
 */
export const tailCommand: CommandHandler = (args, context) => {
  const options = parseLineCountArgs(args);
  return buildHeadTailResult("tail", options, context, (lines, count) =>
    count > 0 ? lines.slice(-count) : [],
  );
};

// ---------------------------------------------------------------------------
// diff
// ---------------------------------------------------------------------------

interface DiffOp {
  type: "equal" | "delete" | "insert";
  line: string;
}

/** 最長共通部分列(LCS)をDPで求め、そこから編集操作列を復元する。 */
function computeDiffOps(a: string[], b: string[]): DiffOp[] {
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: "equal", line: a[i] });
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ type: "delete", line: a[i] });
      i += 1;
    } else {
      ops.push({ type: "insert", line: b[j] });
      j += 1;
    }
  }
  while (i < n) {
    ops.push({ type: "delete", line: a[i] });
    i += 1;
  }
  while (j < m) {
    ops.push({ type: "insert", line: b[j] });
    j += 1;
  }

  return ops;
}

interface DefaultHunk {
  aStart: number;
  aLines: string[];
  bStart: number;
  bLines: string[];
}

function buildDefaultHunks(ops: DiffOp[]): DefaultHunk[] {
  const hunks: DefaultHunk[] = [];
  let aLine = 1;
  let bLine = 1;
  let current: DefaultHunk | null = null;

  for (const op of ops) {
    if (op.type === "equal") {
      current = null;
      aLine += 1;
      bLine += 1;
      continue;
    }
    if (!current) {
      current = { aStart: aLine, aLines: [], bStart: bLine, bLines: [] };
      hunks.push(current);
    }
    if (op.type === "delete") {
      current.aLines.push(op.line);
      aLine += 1;
    } else {
      current.bLines.push(op.line);
      bLine += 1;
    }
  }

  return hunks;
}

function formatDefaultRange(start: number, length: number): string {
  if (length === 0) return `${start - 1}`;
  if (length === 1) return `${start}`;
  return `${start},${start + length - 1}`;
}

function formatDefaultHunk(hunk: DefaultHunk): string {
  const op = hunk.aLines.length > 0 && hunk.bLines.length > 0 ? "c" : hunk.aLines.length > 0 ? "d" : "a";
  const lines = [
    `${formatDefaultRange(hunk.aStart, hunk.aLines.length)}${op}${formatDefaultRange(hunk.bStart, hunk.bLines.length)}`,
    ...hunk.aLines.map((line) => `< ${line}`),
  ];
  if (hunk.aLines.length > 0 && hunk.bLines.length > 0) lines.push("---");
  lines.push(...hunk.bLines.map((line) => `> ${line}`));
  return lines.join("\n");
}

interface PositionedOp extends DiffOp {
  aLine: number;
  bLine: number;
}

function positionOps(ops: DiffOp[]): PositionedOp[] {
  let aLine = 1;
  let bLine = 1;
  return ops.map((op) => {
    const positioned: PositionedOp = { ...op, aLine, bLine };
    if (op.type !== "insert") aLine += 1;
    if (op.type !== "delete") bLine += 1;
    return positioned;
  });
}

const UNIFIED_CONTEXT = 3;

function buildUnifiedHunks(ops: PositionedOp[]): PositionedOp[][] {
  const changeIndices = ops.reduce<number[]>((indices, op, index) => {
    if (op.type !== "equal") indices.push(index);
    return indices;
  }, []);
  if (changeIndices.length === 0) return [];

  const ranges: [number, number][] = [];
  for (const index of changeIndices) {
    const start = Math.max(0, index - UNIFIED_CONTEXT);
    const end = Math.min(ops.length - 1, index + UNIFIED_CONTEXT);
    const last = ranges[ranges.length - 1];
    if (last && start <= last[1] + 1) {
      last[1] = Math.max(last[1], end);
    } else {
      ranges.push([start, end]);
    }
  }

  return ranges.map(([start, end]) => ops.slice(start, end + 1));
}

function formatUnifiedRange(start: number, count: number): string {
  return count === 1 ? `${start}` : `${start},${count}`;
}

function formatUnifiedHunk(hunk: PositionedOp[]): string {
  const first = hunk[0];
  const aCount = hunk.filter((op) => op.type !== "insert").length;
  const bCount = hunk.filter((op) => op.type !== "delete").length;
  const aStart = aCount > 0 ? first.aLine : Math.max(0, first.aLine - 1);
  const bStart = bCount > 0 ? first.bLine : Math.max(0, first.bLine - 1);

  const header = `@@ -${formatUnifiedRange(aStart, aCount)} +${formatUnifiedRange(bStart, bCount)} @@`;
  const body = hunk.map((op) => {
    const prefix = op.type === "equal" ? " " : op.type === "delete" ? "-" : "+";
    return `${prefix}${op.line}`;
  });
  return [header, ...body].join("\n");
}

export const diffCommand: CommandHandler = (args, context) => {
  const { flags, positional } = parseArgs(args);
  const unified = flags.has("u") || flags.has("unified");
  if (positional.length !== 2) return fail("diff: missing operand", 2);

  const [fileA, fileB] = positional;
  let textA: string;
  let textB: string;
  try {
    textA = context.vfs.readFile(resolveArgPath(context, fileA));
  } catch (error) {
    return fail(describeVfsError("diff", fileA, error), 2);
  }
  try {
    textB = context.vfs.readFile(resolveArgPath(context, fileB));
  } catch (error) {
    return fail(describeVfsError("diff", fileB, error), 2);
  }

  const linesA = toLines(textA);
  const linesB = toLines(textB);
  if (linesA.length === linesB.length && linesA.every((line, index) => line === linesB[index])) {
    return ok("");
  }

  const ops = computeDiffOps(linesA, linesB);

  if (unified) {
    const hunks = buildUnifiedHunks(positionOps(ops));
    const body = hunks.map(formatUnifiedHunk).join("\n");
    return { stdout: `--- ${fileA}\n+++ ${fileB}\n${body}\n`, stderr: "", exitCode: 1 };
  }

  const body = buildDefaultHunks(ops).map(formatDefaultHunk).join("\n");
  return { stdout: `${body}\n`, stderr: "", exitCode: 1 };
};
