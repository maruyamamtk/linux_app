import type { VirtualFileSystem } from "../vfs";
import { collectAncestors, isAncestor } from "./commit";
import { GitError } from "./errors";
import { objectExists, readObject, writeObject } from "./objectStore";
import { readBranchHash, writeBranchHash, writeRemoteBranchHash } from "./refs";
import type { GitCommitObject, GitTreeObject } from "./types";

function collectTreeObjectHashes(
  vfs: VirtualFileSystem,
  repoPath: string,
  treeHash: string,
  result: Set<string>,
): void {
  if (result.has(treeHash)) return;
  result.add(treeHash);
  const tree = readObject(vfs, repoPath, treeHash) as GitTreeObject;
  for (const entry of tree.entries) {
    if (entry.type === "tree") collectTreeObjectHashes(vfs, repoPath, entry.hash, result);
    else result.add(entry.hash);
  }
}

/** `commitHash`から到達可能な全オブジェクト(commit/tree/blob)のハッシュ(push/pullでのコピー対象、3.6節)。 */
function collectReachableObjectHashes(vfs: VirtualFileSystem, repoPath: string, commitHash: string): Set<string> {
  const result = new Set<string>();
  for (const hash of collectAncestors(vfs, repoPath, commitHash)) {
    result.add(hash);
    const commit = readObject(vfs, repoPath, hash) as GitCommitObject;
    collectTreeObjectHashes(vfs, repoPath, commit.tree, result);
  }
  return result;
}

/** `fromRepoPath`側にしかまだ無いオブジェクトを`toRepoPath`側のオブジェクトストアへコピーする。 */
function copyObjects(vfs: VirtualFileSystem, fromRepoPath: string, toRepoPath: string, hashes: Set<string>): void {
  for (const hash of hashes) {
    if (objectExists(vfs, toRepoPath, hash)) continue;
    writeObject(vfs, toRepoPath, readObject(vfs, fromRepoPath, hash));
  }
}

export type PushOutcome = { type: "up-to-date" } | { type: "ok"; hash: string } | { type: "rejected" };

/**
 * `git push origin <branch>`(design 3.6節)。ローカルの`refs/heads/<branch>`から到達可能な
 * オブジェクトのうちリモートに無いものをコピーし、リモートの`refs/heads/<branch>`を更新する。
 * リモートの現在のコミットがローカルの祖先でない場合(fast-forwardでない場合)は拒否する。
 */
export function pushBranch(
  vfs: VirtualFileSystem,
  repoPath: string,
  remotePath: string,
  branch: string,
): PushOutcome {
  const localHash = readBranchHash(vfs, repoPath, branch);
  if (!localHash) throw new GitError(`src refspec ${branch} does not match any`);

  const remoteHash = readBranchHash(vfs, remotePath, branch);
  if (remoteHash === localHash) return { type: "up-to-date" };
  if (remoteHash && (!objectExists(vfs, repoPath, remoteHash) || !isAncestor(vfs, repoPath, remoteHash, localHash))) {
    return { type: "rejected" };
  }

  copyObjects(vfs, repoPath, remotePath, collectReachableObjectHashes(vfs, repoPath, localHash));
  writeBranchHash(vfs, remotePath, branch, localHash);
  return { type: "ok", hash: localHash };
}

/**
 * `git fetch`相当(design 3.6節: `git pull`はfetch+mergeの合成として実装する)。リモートの
 * `refs/heads/<branch>`から到達可能な未取得オブジェクトをローカルにコピーし、
 * `refs/remotes/<remote>/<branch>`を更新する。リモートに`<branch>`が無ければ`undefined`を返す。
 */
export function fetchBranch(
  vfs: VirtualFileSystem,
  repoPath: string,
  remotePath: string,
  remoteName: string,
  branch: string,
): string | undefined {
  const remoteHash = readBranchHash(vfs, remotePath, branch);
  if (!remoteHash) return undefined;

  copyObjects(vfs, remotePath, repoPath, collectReachableObjectHashes(vfs, remotePath, remoteHash));
  writeRemoteBranchHash(vfs, repoPath, remoteName, branch, remoteHash);
  return remoteHash;
}
