import type { VirtualFileSystem } from "../vfs";
import { readObject, writeObject } from "./objectStore";
import type { GitCommitObject } from "./types";

/** VFSの現在ユーザーからauthor情報を自動導出する(4章: `git config`はスコープ外)。 */
export function authorFromUser(vfs: VirtualFileSystem): string {
  const user = vfs.getUser();
  return `${user.name} <${user.name}@localhost>`;
}

/** 親コミットの`sequence`の最大値+1(initial commitは0)。実時刻は使用しない(8章)。 */
export function nextSequence(vfs: VirtualFileSystem, repoPath: string, parents: string[]): number {
  if (parents.length === 0) return 0;
  const sequences = parents.map((hash) => (readObject(vfs, repoPath, hash) as GitCommitObject).sequence);
  return Math.max(...sequences) + 1;
}

export interface CreateCommitResult {
  hash: string;
  commit: GitCommitObject;
}

/** `treeHash`を指すcommitオブジェクトを作成し、objectストアへ書き込む。refの更新は呼び出し元が行う。 */
export function createCommit(
  vfs: VirtualFileSystem,
  repoPath: string,
  treeHash: string,
  message: string,
  parents: string[],
): CreateCommitResult {
  const commit: GitCommitObject = {
    type: "commit",
    tree: treeHash,
    parents,
    author: authorFromUser(vfs),
    message,
    sequence: nextSequence(vfs, repoPath, parents),
  };
  const hash = writeObject(vfs, repoPath, commit);
  return { hash, commit };
}

/** `commitHash`から`parents`をたどって到達可能な全コミットハッシュを集める(自身も含む)。 */
export function collectAncestors(vfs: VirtualFileSystem, repoPath: string, commitHash: string): Set<string> {
  const visited = new Set<string>();
  const stack = [commitHash];
  while (stack.length > 0) {
    const hash = stack.pop()!;
    if (visited.has(hash)) continue;
    visited.add(hash);
    const commit = readObject(vfs, repoPath, hash) as GitCommitObject;
    stack.push(...commit.parents);
  }
  return visited;
}

/** `ancestorHash`が`commitHash`の祖先(または`commitHash`自身)であるかを判定する。 */
export function isAncestor(
  vfs: VirtualFileSystem,
  repoPath: string,
  ancestorHash: string,
  commitHash: string,
): boolean {
  return collectAncestors(vfs, repoPath, commitHash).has(ancestorHash);
}

/**
 * `hashA`と`hashB`の共通祖先のうち最も新しいもの(sequenceが最大のもの)を返す(7章)。
 * 共通祖先が無い場合(共通の初期コミットを持たない履歴)は`undefined`を返す。
 */
export function findMergeBase(
  vfs: VirtualFileSystem,
  repoPath: string,
  hashA: string,
  hashB: string,
): string | undefined {
  const ancestorsOfA = collectAncestors(vfs, repoPath, hashA);

  let best: string | undefined;
  let bestSequence = -1;
  const visited = new Set<string>();
  const stack = [hashB];

  while (stack.length > 0) {
    const hash = stack.pop()!;
    if (visited.has(hash)) continue;
    visited.add(hash);

    const commit = readObject(vfs, repoPath, hash) as GitCommitObject;
    if (ancestorsOfA.has(hash)) {
      if (commit.sequence > bestSequence) {
        bestSequence = commit.sequence;
        best = hash;
      }
      continue;
    }
    stack.push(...commit.parents);
  }

  return best;
}
