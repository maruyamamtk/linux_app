import { findRemoteHost } from "../ssh";
import type { VfsSnapshot } from "../vfs";
import { fail, ok } from "./errors";
import type { CommandHandler } from "./types";

interface SshTarget {
  user?: string;
  host: string;
}

function parseTarget(arg: string | undefined): SshTarget | undefined {
  if (!arg) return undefined;
  const at = arg.indexOf("@");
  if (at === -1) return { host: arg };
  return { user: arg.slice(0, at) || undefined, host: arg.slice(at + 1) };
}

/**
 * `ssh [user@]host`。固定の仮想リモートホスト一覧(`engine/ssh`)に登録されたホストへのみ接続でき、
 * 接続すると`context.vfs`のツリーをそのホスト用のスナップショットへ入れ替える(実体は同じ`VirtualFileSystem`
 * インスタンスを使い回すため、`su`のユーザー切り替えと同様に以後のコマンドへ持続する)。
 * 接続前のローカル側の状態は`context.ssh.saved`に退避しておき、`exit`(simpleCommand.ts)で復帰する。
 */
export const sshCommand: CommandHandler = (args, context) => {
  const target = parseTarget(args[0]);
  if (!target || target.host.length === 0) {
    return fail("usage: ssh [user@]hostname");
  }

  if (context.ssh.remoteHost) {
    return fail(
      `ssh: already connected to ${context.ssh.remoteHost}. Run 'exit' to disconnect first.`,
    );
  }

  const remote = findRemoteHost(target.host);
  if (!remote) {
    return fail(`ssh: Could not resolve hostname ${target.host}: Name or service not known`);
  }

  const localSnapshot: VfsSnapshot = { id: "local-ssh-return", root: context.vfs.getRootNode() };
  context.ssh.saved = { snapshot: localSnapshot, cwd: context.cwd, env: { ...context.env } };
  context.ssh.remoteHost = remote.promptHost;

  context.vfs.load(remote.snapshot);
  context.cwd = remote.homeDir;
  context.env.HOME = remote.homeDir;

  return ok(remote.banner);
};
