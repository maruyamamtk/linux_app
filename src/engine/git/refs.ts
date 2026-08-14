import { dirname, joinPath } from "../vfs";
import type { VirtualFileSystem } from "../vfs";
import { GitError } from "./errors";
import { gitDir } from "./repo";

function headPath(repoPath: string): string {
  return joinPath(gitDir(repoPath), "HEAD");
}

function branchRefPath(repoPath: string, branch: string): string {
  return joinPath(gitDir(repoPath), "refs", "heads", branch);
}

function remoteBranchRefPath(repoPath: string, remote: string, branch: string): string {
  return joinPath(gitDir(repoPath), "refs", "remotes", remote, branch);
}

const HEAD_REF_PATTERN = /^ref: refs\/heads\/(.+)$/;

/**
 * `HEAD`が指すブランチ名を返す。本シミュレータはdetached HEAD状態をスコープ外とし
 * (4.6節)、`HEAD`は常に`ref: refs/heads/<branch>`の形式であることを前提とする。
 */
export function readHeadBranch(vfs: VirtualFileSystem, repoPath: string): string {
  const content = vfs.readFile(headPath(repoPath)).trim();
  const match = HEAD_REF_PATTERN.exec(content);
  if (!match) throw new GitError("HEAD is not a branch ref (detached HEAD is not supported)");
  return match[1];
}

export function writeHeadBranch(vfs: VirtualFileSystem, repoPath: string, branch: string): void {
  vfs.writeFile(headPath(repoPath), `ref: refs/heads/${branch}\n`);
}

/** ブランチがまだ1つもコミットを持たない(unborn)場合は`undefined`を返す。 */
export function readBranchHash(
  vfs: VirtualFileSystem,
  repoPath: string,
  branch: string,
): string | undefined {
  const path = branchRefPath(repoPath, branch);
  if (!vfs.exists(path)) return undefined;
  return vfs.readFile(path).trim();
}

export function writeBranchHash(
  vfs: VirtualFileSystem,
  repoPath: string,
  branch: string,
  hash: string,
): void {
  vfs.writeFile(branchRefPath(repoPath, branch), `${hash}\n`);
}

export function branchExists(vfs: VirtualFileSystem, repoPath: string, branch: string): boolean {
  return vfs.exists(branchRefPath(repoPath, branch));
}

export function listBranches(vfs: VirtualFileSystem, repoPath: string): string[] {
  const headsDir = joinPath(gitDir(repoPath), "refs", "heads");
  if (!vfs.exists(headsDir)) return [];
  return vfs
    .readdir(headsDir)
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

/** `refs/remotes/<remote>/<branch>`(直近のfetch/pull/push時点のリモート追跡ブランチ、3.6節)。未取得なら`undefined`。 */
export function readRemoteBranchHash(
  vfs: VirtualFileSystem,
  repoPath: string,
  remote: string,
  branch: string,
): string | undefined {
  const path = remoteBranchRefPath(repoPath, remote, branch);
  if (!vfs.exists(path)) return undefined;
  return vfs.readFile(path).trim();
}

export function writeRemoteBranchHash(
  vfs: VirtualFileSystem,
  repoPath: string,
  remote: string,
  branch: string,
  hash: string,
): void {
  const path = remoteBranchRefPath(repoPath, remote, branch);
  const parent = dirname(path);
  if (!vfs.exists(parent)) vfs.mkdir(parent, { recursive: true });
  vfs.writeFile(path, `${hash}\n`);
}
