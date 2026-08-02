import { VfsError, normalizePath, type VfsStat } from "../vfs";
import { parseArgs } from "./args";
import { describeVfsError, fail, ok } from "./errors";
import type { CommandContext, CommandHandler } from "./types";

function resolveArgPath(context: CommandContext, path: string): string {
  return normalizePath(path, context.cwd);
}

function formatLongEntry(stat: VfsStat): string {
  return `${stat.formattedMode} ${stat.owner} ${stat.group} ${String(stat.size).padStart(6)} ${stat.name}`;
}

export const pwdCommand: CommandHandler = (_args, context) => ok(`${context.cwd}\n`);

/** `cd` は組み込みコマンドとしてセッションの `cwd` を直接書き換える。 */
export const cdCommand: CommandHandler = (args, context) => {
  const target = args[0] ?? context.env.HOME ?? "/";
  const resolved = resolveArgPath(context, target);

  if (!context.vfs.exists(resolved)) {
    return fail(`cd: ${target}: No such file or directory`);
  }
  if (context.vfs.stat(resolved).type !== "directory") {
    return fail(`cd: ${target}: Not a directory`);
  }

  context.cwd = resolved;
  return ok("");
};

export const lsCommand: CommandHandler = (args, context) => {
  const { flags, positional } = parseArgs(args);
  const showAll = flags.has("a") || flags.has("all");
  const longFormat = flags.has("l");
  const targets = positional.length > 0 ? positional : ["."];

  const sections: string[] = [];
  const errors: string[] = [];

  for (const target of targets) {
    const resolved = resolveArgPath(context, target);
    try {
      const stat = context.vfs.stat(resolved);
      if (stat.type === "file") {
        sections.push(longFormat ? formatLongEntry(stat) : stat.name);
        continue;
      }

      const entries = context.vfs
        .readdir(resolved)
        .filter((entry) => showAll || !entry.name.startsWith("."));
      const listing = longFormat
        ? entries.map(formatLongEntry).join("\n")
        : entries.map((entry) => entry.name).join("  ");
      const header = targets.length > 1 ? `${target}:\n` : "";
      sections.push(`${header}${listing}`);
    } catch (error) {
      errors.push(describeVfsError("ls", target, error));
    }
  }

  const stdout = sections.filter((section) => section.length > 0).join("\n\n");
  return {
    stdout: stdout.length > 0 ? `${stdout}\n` : "",
    stderr: errors.length > 0 ? `${errors.join("\n")}\n` : "",
    exitCode: errors.length > 0 ? 1 : 0,
  };
};

export const mkdirCommand: CommandHandler = (args, context) => {
  const { flags, positional } = parseArgs(args);
  if (positional.length === 0) return fail("mkdir: missing operand");
  const recursive = flags.has("p") || flags.has("parents");

  const errors: string[] = [];
  for (const target of positional) {
    try {
      context.vfs.mkdir(resolveArgPath(context, target), { recursive });
    } catch (error) {
      errors.push(describeVfsError("mkdir", target, error, "cannot create directory"));
    }
  }
  return errors.length > 0 ? fail(errors.join("\n")) : ok("");
};

export const touchCommand: CommandHandler = (args, context) => {
  const { positional } = parseArgs(args);
  if (positional.length === 0) return fail("touch: missing file operand");

  const errors: string[] = [];
  for (const target of positional) {
    const resolved = resolveArgPath(context, target);
    try {
      if (context.vfs.exists(resolved)) {
        // ディレクトリの更新時刻はVFSが保持していないため、既存ファイルの場合のみ
        // 内容を書き戻して「触れた」ことにする(書き込み権限のチェックは自然に発生する)。
        if (context.vfs.stat(resolved).type === "file") {
          context.vfs.writeFile(resolved, context.vfs.readFile(resolved));
        }
        continue;
      }
      context.vfs.writeFile(resolved, "");
    } catch (error) {
      errors.push(describeVfsError("touch", target, error, "cannot touch"));
    }
  }
  return errors.length > 0 ? fail(errors.join("\n")) : ok("");
};

export const rmCommand: CommandHandler = (args, context) => {
  const { flags, positional } = parseArgs(args);
  const recursive = flags.has("r") || flags.has("R") || flags.has("recursive");
  const force = flags.has("f") || flags.has("force");

  if (positional.length === 0) {
    return force ? ok("") : fail("rm: missing operand");
  }

  const errors: string[] = [];
  for (const target of positional) {
    const resolved = resolveArgPath(context, target);
    try {
      if (!context.vfs.exists(resolved)) {
        if (!force) errors.push(`rm: cannot remove '${target}': No such file or directory`);
        continue;
      }
      if (context.vfs.stat(resolved).type === "directory" && !recursive) {
        errors.push(`rm: cannot remove '${target}': Is a directory`);
        continue;
      }
      context.vfs.remove(resolved, { recursive });
    } catch (error) {
      if (!force) errors.push(describeVfsError("rm", target, error, "cannot remove"));
    }
  }
  return errors.length > 0 ? fail(errors.join("\n")) : ok("");
};

export const rmdirCommand: CommandHandler = (args, context) => {
  const { positional } = parseArgs(args);
  if (positional.length === 0) return fail("rmdir: missing operand");

  const errors: string[] = [];
  for (const target of positional) {
    const resolved = resolveArgPath(context, target);
    try {
      if (context.vfs.stat(resolved).type !== "directory") {
        errors.push(`rmdir: failed to remove '${target}': Not a directory`);
        continue;
      }
      context.vfs.remove(resolved, { recursive: false });
    } catch (error) {
      errors.push(describeVfsError("rmdir", target, error, "failed to remove"));
    }
  }
  return errors.length > 0 ? fail(errors.join("\n")) : ok("");
};

export const cpCommand: CommandHandler = (args, context) => {
  const { flags, positional } = parseArgs(args);
  const recursive = flags.has("r") || flags.has("R") || flags.has("recursive");
  if (positional.length < 2) return fail("cp: missing file operand");

  const sources = positional.slice(0, -1);
  const destArg = positional[positional.length - 1];
  const resolvedDest = resolveArgPath(context, destArg);
  const destIsDir = context.vfs.exists(resolvedDest) && context.vfs.stat(resolvedDest).type === "directory";

  if (sources.length > 1 && !destIsDir) {
    return fail(`cp: target '${destArg}' is not a directory`);
  }

  const errors: string[] = [];
  for (const source of sources) {
    try {
      context.vfs.copy(resolveArgPath(context, source), resolvedDest, { recursive });
    } catch (error) {
      if (error instanceof VfsError && error.code === "EISDIR") {
        errors.push(`cp: -r not specified; omitting directory '${source}'`);
        continue;
      }
      errors.push(describeVfsError("cp", source, error, "cannot stat"));
    }
  }
  return errors.length > 0 ? fail(errors.join("\n")) : ok("");
};

export const mvCommand: CommandHandler = (args, context) => {
  const { positional } = parseArgs(args);
  if (positional.length < 2) return fail("mv: missing file operand");

  const sources = positional.slice(0, -1);
  const destArg = positional[positional.length - 1];
  const resolvedDest = resolveArgPath(context, destArg);
  const destIsDir = context.vfs.exists(resolvedDest) && context.vfs.stat(resolvedDest).type === "directory";

  if (sources.length > 1 && !destIsDir) {
    return fail(`mv: target '${destArg}' is not a directory`);
  }

  const errors: string[] = [];
  for (const source of sources) {
    try {
      context.vfs.move(resolveArgPath(context, source), resolvedDest);
    } catch (error) {
      errors.push(describeVfsError("mv", source, error, "cannot stat"));
    }
  }
  return errors.length > 0 ? fail(errors.join("\n")) : ok("");
};

/**
 * VFSはinode(実体)とディレクトリエントリ(名前)を分離したモデルを持たず、
 * ノードは常に単一の場所にのみ存在する前提で実装されている。そのため `ln` /
 * `ln -s` はどちらも「作成時点の内容をコピーする」ことで近似する
 * (以後、片方への書き込みがもう片方に反映される、という本来のハードリンクの
 * 挙動までは再現できない)。真のリンクを再現するにはVFS側にinode層の導入が必要。
 */
export const lnCommand: CommandHandler = (args, context) => {
  const { flags, positional } = parseArgs(args);
  const symbolic = flags.has("s") || flags.has("symbolic");
  if (positional.length < 2) return fail("ln: missing file operand");

  const [sourceArg, destArg] = positional;
  const resolvedSource = resolveArgPath(context, sourceArg);

  try {
    if (!symbolic && context.vfs.stat(resolvedSource).type === "directory") {
      return fail(`ln: ${sourceArg}: hard link not allowed for directory`);
    }
    context.vfs.copy(resolvedSource, resolveArgPath(context, destArg), { recursive: symbolic });
    return ok("");
  } catch (error) {
    return fail(describeVfsError("ln", sourceArg, error, "failed to create link"));
  }
};
