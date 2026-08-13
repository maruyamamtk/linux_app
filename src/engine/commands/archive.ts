import { dirname, joinPath, normalizePath } from "../vfs";
import { parseArgs } from "./args";
import { describeVfsError, fail, ok } from "./errors";
import type { CommandContext, CommandHandler } from "./types";

function resolveArgPath(context: CommandContext, path: string): string {
  return normalizePath(path, context.cwd);
}

/**
 * このシミュレータは実バイト圧縮を行わない(要件定義書Ch18節参照)。tar/zipが生成する
 * アーカイブファイルは「含まれるファイルの一覧・内容・パーミッション」を持つJSONとして
 * VFS上の通常ファイルに保存し、gzip/bzip2はその文字列をさらに1段ラップするだけの
 * メタデータ表現とする。展開コマンドはこのJSONを読み戻して元のファイルを再構築する。
 */
interface ArchiveEntry {
  path: string;
  type: "file" | "directory";
  mode: number;
  owner: string;
  group: string;
  content?: string;
}

interface TarPayload {
  kind: "tar";
  entries: ArchiveEntry[];
}

interface ZipPayload {
  kind: "zip";
  entries: ArchiveEntry[];
}

interface CompressedPayload {
  kind: "gzip" | "bzip2";
  content: string;
  mode: number;
}

type ArchivePayload = TarPayload | ZipPayload | CompressedPayload;

const ARCHIVE_KINDS = ["tar", "zip", "gzip", "bzip2"];

function parsePayload(raw: string): ArchivePayload | null {
  try {
    const data: unknown = JSON.parse(raw);
    if (
      data !== null &&
      typeof data === "object" &&
      "kind" in data &&
      ARCHIVE_KINDS.includes((data as { kind: string }).kind)
    ) {
      return data as ArchivePayload;
    }
    return null;
  } catch {
    return null;
  }
}

/** gzip/bzip2でラップされている間、内側のJSONを再帰的に読み解く(`tar czvf`等が生成した多重ラップに対応)。 */
function unwrapCompression(raw: string): ArchivePayload | null {
  let current = parsePayload(raw);
  while (current && (current.kind === "gzip" || current.kind === "bzip2")) {
    current = parsePayload(current.content);
  }
  return current;
}

function formatEntryMode(entry: ArchiveEntry): string {
  const typeChar = entry.type === "directory" ? "d" : "-";
  const bits = [entry.mode >> 6, entry.mode >> 3, entry.mode].map((part) => part & 0b111);
  const rendered = bits
    .map(
      (part) => `${part & 0b100 ? "r" : "-"}${part & 0b010 ? "w" : "-"}${part & 0b001 ? "x" : "-"}`,
    )
    .join("");
  return `${typeChar}${rendered}`;
}

function entrySize(entry: ArchiveEntry): number {
  return entry.type === "file" ? (entry.content?.length ?? 0) : 0;
}

function toStoredPath(target: string, fallback: string): string {
  const stripped = target
    .replace(/^(\.\/)+/, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  return stripped.length > 0 ? stripped : fallback;
}

/** ディレクトリを再帰的に(recursive=falseの場合はディレクトリ自身のみ)エントリ化する。 */
function walkEntries(
  context: CommandContext,
  resolvedPath: string,
  storedPath: string,
  recursive: boolean,
  entries: ArchiveEntry[],
): void {
  const stat = context.vfs.stat(resolvedPath);
  if (stat.type === "file") {
    entries.push({
      path: storedPath,
      type: "file",
      mode: stat.mode,
      owner: stat.owner,
      group: stat.group,
      content: context.vfs.readFile(resolvedPath),
    });
    return;
  }

  entries.push({
    path: `${storedPath}/`,
    type: "directory",
    mode: stat.mode,
    owner: stat.owner,
    group: stat.group,
  });
  if (!recursive) return;

  for (const child of context.vfs.readdir(resolvedPath)) {
    walkEntries(
      context,
      joinPath(resolvedPath, child.name),
      `${storedPath}/${child.name}`,
      recursive,
      entries,
    );
  }
}

function collectEntries(
  context: CommandContext,
  commandLabel: string,
  targets: string[],
  recursive: boolean,
): { entries: ArchiveEntry[]; errors: string[] } {
  const entries: ArchiveEntry[] = [];
  const errors: string[] = [];

  for (const target of targets) {
    const resolved = resolveArgPath(context, target);
    try {
      const storedPath = toStoredPath(target, context.vfs.stat(resolved).name);
      walkEntries(context, resolved, storedPath, recursive, entries);
    } catch (error) {
      errors.push(describeVfsError(commandLabel, target, error, "Cannot stat"));
    }
  }

  return { entries, errors };
}

function matchesFilter(entryPath: string, filters: string[]): boolean {
  const normalizedEntry = entryPath.replace(/\/$/, "");
  return filters.some((filter) => {
    const normalizedFilter = filter.replace(/^(\.\/)+/, "").replace(/\/+$/, "");
    return (
      normalizedEntry === normalizedFilter || normalizedEntry.startsWith(`${normalizedFilter}/`)
    );
  });
}

function extractEntry(context: CommandContext, entry: ArchiveEntry): void {
  const target = resolveArgPath(context, entry.path.replace(/\/$/, ""));
  if (entry.type === "directory") {
    context.vfs.mkdir(target, { recursive: true, mode: entry.mode });
    return;
  }

  const parent = dirname(target);
  if (!context.vfs.exists(parent)) {
    context.vfs.mkdir(parent, { recursive: true });
  }
  context.vfs.writeFile(target, entry.content ?? "", { mode: entry.mode });
}

/** `tar cvf archive.tar file...` のような、ダッシュ無しの旧BSD形式のオプションを`-`付きに正規化する。 */
function normalizeTarArgs(args: string[]): string[] {
  if (args.length > 0 && /^[a-zA-Z]+$/.test(args[0])) {
    return [`-${args[0]}`, ...args.slice(1)];
  }
  return args;
}

/**
 * `tar [c|x|t][v][z|j]f archive file...`。作成(c)/展開(x)/一覧(t)のいずれか1つに加えて、
 * v(詳細表示)・z(gzip同時圧縮)・j(bzip2同時圧縮)を組み合わせられる。アーカイブ名は
 * 常に最初の非オプション引数として扱う(`-f`の値取り出しは行わない簡易実装)。
 */
export const tarCommand: CommandHandler = (rawArgs, context) => {
  const { flags, positional } = parseArgs(normalizeTarArgs(rawArgs));
  const create = flags.has("c");
  const extract = flags.has("x");
  const list = flags.has("t");
  const verbose = flags.has("v");
  const useGzip = flags.has("z");
  const useBzip2 = flags.has("j");

  if (Number(create) + Number(extract) + Number(list) !== 1) {
    return fail("tar: You must specify one of the '-ctx' options");
  }
  if (positional.length === 0) {
    return fail("tar: missing archive operand (use -f <archive>)");
  }

  const archiveArg = positional[0];
  const resolvedArchive = resolveArgPath(context, archiveArg);

  if (create) {
    const targets = positional.slice(1);
    if (targets.length === 0) {
      return fail("tar: Cowardly refusing to create an empty archive");
    }

    const { entries, errors } = collectEntries(context, "tar", targets, true);
    if (errors.length > 0) {
      return fail(`${errors.join("\n")}\n`);
    }

    const tarPayload: TarPayload = { kind: "tar", entries };
    const serializedTar = JSON.stringify(tarPayload);
    const compressedKind = useGzip ? "gzip" : useBzip2 ? "bzip2" : undefined;
    const finalContent = compressedKind
      ? JSON.stringify({
          kind: compressedKind,
          content: serializedTar,
          mode: 0o644,
        } satisfies CompressedPayload)
      : serializedTar;

    try {
      context.vfs.writeFile(resolvedArchive, finalContent);
    } catch (error) {
      return fail(describeVfsError("tar", archiveArg, error, "cannot create"));
    }

    const stdout = verbose ? entries.map((entry) => entry.path).join("\n") : "";
    return ok(stdout.length > 0 ? `${stdout}\n` : "");
  }

  let raw: string;
  try {
    if (!context.vfs.exists(resolvedArchive)) {
      return fail(`tar: ${archiveArg}: Cannot open: No such file or directory`);
    }
    if (context.vfs.stat(resolvedArchive).type === "directory") {
      return fail(`tar: ${archiveArg}: Cannot open: Is a directory`);
    }
    raw = context.vfs.readFile(resolvedArchive);
  } catch (error) {
    return fail(describeVfsError("tar", archiveArg, error, "Cannot open"));
  }

  const payload = unwrapCompression(raw);
  if (!payload || payload.kind !== "tar") {
    return fail(`tar: ${archiveArg}: This does not look like a tar archive`);
  }

  const filters = positional.slice(1);
  const selected =
    filters.length > 0
      ? payload.entries.filter((entry) => matchesFilter(entry.path, filters))
      : payload.entries;

  if (list) {
    const lines = selected.map((entry) =>
      verbose
        ? `${formatEntryMode(entry)} ${entry.owner}/${entry.group} ` +
          `${String(entrySize(entry)).padStart(8)} ${entry.path}`
        : entry.path,
    );
    return ok(lines.length > 0 ? `${lines.join("\n")}\n` : "");
  }

  const errors: string[] = [];
  const lines: string[] = [];
  for (const entry of selected) {
    try {
      extractEntry(context, entry);
      if (verbose) lines.push(entry.path);
    } catch (error) {
      errors.push(describeVfsError("tar", entry.path, error, "Cannot extract"));
    }
  }

  return {
    stdout: lines.length > 0 ? `${lines.join("\n")}\n` : "",
    stderr: errors.length > 0 ? `${errors.join("\n")}\n` : "",
    exitCode: errors.length > 0 ? 1 : 0,
  };
};

function tryReadZipPayload(context: CommandContext, resolvedPath: string): ZipPayload | null {
  try {
    const payload = parsePayload(context.vfs.readFile(resolvedPath));
    return payload && payload.kind === "zip" ? payload : null;
  } catch {
    return null;
  }
}

/**
 * `zip [-r] archive.zip file...`。既存のアーカイブに対しては同じパスのエントリを
 * 上書きしつつ他のエントリを保持する(実zipの追記的な挙動を簡易的に再現)。
 */
export const zipCommand: CommandHandler = (args, context) => {
  const { flags, positional } = parseArgs(args);
  const recursive = flags.has("r") || flags.has("recursive");

  if (positional.length < 2) {
    return fail("zip: missing operand (usage: zip [-r] archive.zip file...)");
  }

  const archiveArg = positional[0];
  const resolvedArchive = resolveArgPath(context, archiveArg);
  const targets = positional.slice(1);

  const { entries: newEntries, errors } = collectEntries(context, "zip", targets, recursive);
  if (errors.length > 0) {
    return fail(`${errors.join("\n")}\n`);
  }

  const existing = context.vfs.exists(resolvedArchive)
    ? tryReadZipPayload(context, resolvedArchive)
    : null;
  const merged = new Map<string, ArchiveEntry>();
  for (const entry of existing?.entries ?? []) merged.set(entry.path, entry);
  for (const entry of newEntries) merged.set(entry.path, entry);

  const payload: ZipPayload = { kind: "zip", entries: [...merged.values()] };
  try {
    context.vfs.writeFile(resolvedArchive, JSON.stringify(payload));
  } catch (error) {
    return fail(describeVfsError("zip", archiveArg, error, "cannot create"));
  }

  const lines = [
    `  adding: ${archiveArg}`,
    ...newEntries.map(
      (entry) => `  adding: ${entry.path}${entry.type === "file" ? " (stored)" : ""}`,
    ),
  ];
  return ok(`${lines.join("\n")}\n`);
};

/** `unzip [-l] archive.zip [file...]`。既定では全ファイルを展開し、`-l`で一覧のみ表示する。 */
export const unzipCommand: CommandHandler = (args, context) => {
  const { flags, positional } = parseArgs(args);
  const listOnly = flags.has("l");

  if (positional.length === 0) {
    return fail("unzip: missing operand (usage: unzip [-l] archive.zip)");
  }

  const archiveArg = positional[0];
  const resolvedArchive = resolveArgPath(context, archiveArg);

  let raw: string;
  try {
    if (!context.vfs.exists(resolvedArchive)) {
      return fail(`unzip:  cannot find or open ${archiveArg}`);
    }
    raw = context.vfs.readFile(resolvedArchive);
  } catch (error) {
    return fail(describeVfsError("unzip", archiveArg, error, "cannot open"));
  }

  const payload = parsePayload(raw);
  if (!payload || payload.kind !== "zip") {
    return fail(`unzip:  ${archiveArg}: not a valid zip archive`);
  }

  const filters = positional.slice(1);
  const selected =
    filters.length > 0
      ? payload.entries.filter((entry) => matchesFilter(entry.path, filters))
      : payload.entries;

  if (listOnly) {
    const lines = selected.map((entry) => `${String(entrySize(entry)).padStart(9)}  ${entry.path}`);
    const total = selected.reduce((sum, entry) => sum + entrySize(entry), 0);
    return ok(
      `${[
        `Archive:  ${archiveArg}`,
        "  Length      Name",
        "---------    ----",
        ...lines,
        "---------    -------",
        `${String(total).padStart(9)}    ${selected.length} files`,
      ].join("\n")}\n`,
    );
  }

  const errors: string[] = [];
  const lines: string[] = [`Archive:  ${archiveArg}`];
  for (const entry of selected) {
    try {
      extractEntry(context, entry);
      lines.push(
        entry.type === "directory" ? `   creating: ${entry.path}` : `  inflating: ${entry.path}`,
      );
    } catch (error) {
      errors.push(describeVfsError("unzip", entry.path, error, "cannot create"));
    }
  }

  return {
    stdout: `${lines.join("\n")}\n`,
    stderr: errors.length > 0 ? `${errors.join("\n")}\n` : "",
    exitCode: errors.length > 0 ? 1 : 0,
  };
};

/**
 * gzip/gunzip・bzip2/bunzip2は同じ構造(単一ファイルを圧縮/伸長する)を持つため、
 * kind/拡張子/既定動作(圧縮 or 伸長)だけを差し替えたファクトリで実装を共有する。
 */
function makeCompressCommand(
  commandName: string,
  kind: "gzip" | "bzip2",
  suffix: string,
  decompressDefault: boolean,
): CommandHandler {
  return (args, context) => {
    const { flags, positional } = parseArgs(args);
    const decompress = decompressDefault || flags.has("d") || flags.has("decompress");
    const keep = flags.has("k") || flags.has("keep");

    if (positional.length === 0) {
      return fail(`${commandName}: missing operand`);
    }

    const errors: string[] = [];
    for (const target of positional) {
      const resolved = resolveArgPath(context, target);
      try {
        if (!context.vfs.exists(resolved)) {
          errors.push(`${commandName}: ${target}: No such file or directory`);
          continue;
        }
        if (context.vfs.stat(resolved).type === "directory") {
          errors.push(`${commandName}: ${target} is a directory -- ignored`);
          continue;
        }

        if (decompress) {
          if (!target.endsWith(suffix)) {
            errors.push(`${commandName}: ${target}: unknown suffix -- ignored`);
            continue;
          }
          const payload = parsePayload(context.vfs.readFile(resolved));
          if (!payload || payload.kind !== kind) {
            errors.push(`${commandName}: ${target}: not in ${kind} format`);
            continue;
          }
          const destPath = resolved.slice(0, -suffix.length);
          context.vfs.writeFile(destPath, payload.content, { mode: payload.mode });
          if (!keep) context.vfs.remove(resolved);
        } else {
          if (target.endsWith(suffix)) {
            errors.push(`${commandName}: ${target}: already has ${suffix} suffix -- unchanged`);
            continue;
          }
          const stat = context.vfs.stat(resolved);
          const payload: CompressedPayload = {
            kind,
            content: context.vfs.readFile(resolved),
            mode: stat.mode,
          };
          context.vfs.writeFile(`${resolved}${suffix}`, JSON.stringify(payload));
          if (!keep) context.vfs.remove(resolved);
        }
      } catch (error) {
        errors.push(describeVfsError(commandName, target, error));
      }
    }

    return errors.length > 0 ? fail(`${errors.join("\n")}\n`) : ok("");
  };
}

export const gzipCommand = makeCompressCommand("gzip", "gzip", ".gz", false);
export const gunzipCommand = makeCompressCommand("gunzip", "gzip", ".gz", true);
export const bzip2Command = makeCompressCommand("bzip2", "bzip2", ".bz2", false);
export const bunzip2Command = makeCompressCommand("bunzip2", "bzip2", ".bz2", true);
