import { normalizePath, type VfsUser } from "../vfs";
import { describeVfsError, fail, ok } from "./errors";
import { executeCommand } from "./registry";
import type { CommandContext, CommandHandler } from "./types";

function resolveArgPath(context: CommandContext, path: string): string {
  return normalizePath(path, context.cwd);
}

const SYMBOLIC_TARGET_BITS: Record<string, number> = { u: 0o700, g: 0o070, o: 0o007 };
const PERMISSION_BIT: Record<string, number> = { r: 0o444, w: 0o222, x: 0o111 };
const SYMBOLIC_CLAUSE = /^([ugoa]*)([+\-=])([rwx]*)$/;

function isValidModeString(modeStr: string): boolean {
  if (/^[0-7]{3,4}$/.test(modeStr)) return true;
  return modeStr.length > 0 && modeStr.split(",").every((clause) => SYMBOLIC_CLAUSE.test(clause));
}

function applySymbolicClause(mode: number, clause: string): number {
  const [, targetsStr, operator, permsStr] = SYMBOLIC_CLAUSE.exec(clause)!;
  const targets = targetsStr.length > 0 ? targetsStr.split("") : ["a"];
  const targetMask = targets.reduce(
    (mask, target) => mask | (target === "a" ? 0o777 : SYMBOLIC_TARGET_BITS[target]),
    0,
  );
  const permMask =
    permsStr.split("").reduce((mask, perm) => mask | PERMISSION_BIT[perm], 0) & targetMask;

  if (operator === "+") return mode | permMask;
  if (operator === "-") return mode & ~permMask;
  return (mode & ~targetMask) | permMask;
}

/**
 * `755` のような数値モードと `u+x` / `go-w` / `a=rx` のようなシンボリックモードの
 * 両方に対応する。シンボリックモードは現在のmodeを起点にクローズ(`,`区切りの複数節を順に適用)する。
 */
export function parseMode(modeStr: string, currentMode: number): number {
  if (/^[0-7]{3,4}$/.test(modeStr)) {
    return parseInt(modeStr, 8) & 0o777;
  }
  return modeStr.split(",").reduce((mode, clause) => applySymbolicClause(mode, clause), currentMode);
}

export const chmodCommand: CommandHandler = (args, context) => {
  if (args.length < 2) return fail("chmod: missing operand");
  const [modeArg, ...targets] = args;
  if (!isValidModeString(modeArg)) {
    return fail(`chmod: invalid mode: '${modeArg}'`);
  }

  const errors: string[] = [];
  for (const target of targets) {
    const resolved = resolveArgPath(context, target);
    try {
      const currentMode = context.vfs.stat(resolved).mode;
      context.vfs.chmod(resolved, parseMode(modeArg, currentMode));
    } catch (error) {
      errors.push(describeVfsError("chmod", target, error, "changing permissions of"));
    }
  }
  return errors.length > 0 ? fail(errors.join("\n")) : ok("");
};

/**
 * 演習用の仮想的なユーザー切り替え。実際の認証(パスワード確認)は行わず、
 * `root`ならisRoot、それ以外は指定名のグループを持つ非root一般ユーザーとして扱う。
 */
function resolveUser(name: string): VfsUser {
  if (name === "root") return { name: "root", groups: ["root"], isRoot: true };
  return { name, groups: [name] };
}

/**
 * `su` はセッションのユーザーを直接書き換える組み込みコマンド(`cd`がcwdを書き換えるのと同様)。
 * 引数省略時はrootに切り替わる。
 */
export const suCommand: CommandHandler = (args, context) => {
  const username = args[0] ?? "root";
  context.vfs.setUser(resolveUser(username));
  return ok("");
};

/** `sudo command...` はrootとして1コマンドだけ実行し、その後元のユーザーに戻る。 */
export const sudoCommand: CommandHandler = (args, context) => {
  if (args.length === 0) return fail("usage: sudo command");
  const [name, ...rest] = args;
  const previousUser = context.vfs.getUser();
  context.vfs.setUser(resolveUser("root"));
  try {
    return executeCommand(name, rest, context);
  } finally {
    context.vfs.setUser(previousUser);
  }
};
