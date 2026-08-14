import type { VirtualFileSystem } from "../vfs";
import { createCommit, findMergeBase, isAncestor } from "./commit";
import { writeIndex } from "./indexFile";
import { readObject } from "./objectStore";
import { writeBranchHash } from "./refs";
import { buildTreeFromIndex, flattenTree, materializeTree } from "./tree";
import type { GitCommitObject, GitIndex } from "./types";

export type MergeOutcome =
  | { type: "up-to-date" }
  | { type: "fast-forward"; commitHash: string }
  | { type: "merged"; commitHash: string }
  | { type: "conflict"; paths: string[] };

function entriesByPath(entries: GitIndex): Map<string, GitIndex[number]> {
  return new Map(entries.map((entry) => [entry.path, entry]));
}

/**
 * `git merge <branch>`(7章)。fast-forwardと、非衝突なケースに限った簡易3-wayマージのみ
 * サポートする。衝突が起きた場合はワークツリー・index・refのいずれも変更せず失敗させる。
 */
export function performMerge(
  vfs: VirtualFileSystem,
  repoPath: string,
  currentBranch: string,
  currentHash: string,
  otherHash: string,
  message: string,
): MergeOutcome {
  if (isAncestor(vfs, repoPath, otherHash, currentHash)) {
    return { type: "up-to-date" };
  }

  if (isAncestor(vfs, repoPath, currentHash, otherHash)) {
    const otherCommit = readObject(vfs, repoPath, otherHash) as GitCommitObject;
    writeBranchHash(vfs, repoPath, currentBranch, otherHash);
    writeIndex(vfs, repoPath, flattenTree(vfs, repoPath, otherCommit.tree));
    materializeTree(vfs, repoPath, otherCommit.tree);
    return { type: "fast-forward", commitHash: otherHash };
  }

  const baseHash = findMergeBase(vfs, repoPath, currentHash, otherHash);
  const currentCommit = readObject(vfs, repoPath, currentHash) as GitCommitObject;
  const otherCommit = readObject(vfs, repoPath, otherHash) as GitCommitObject;
  const baseTree = baseHash ? (readObject(vfs, repoPath, baseHash) as GitCommitObject).tree : undefined;

  const baseEntries = entriesByPath(flattenTree(vfs, repoPath, baseTree));
  const currentEntries = entriesByPath(flattenTree(vfs, repoPath, currentCommit.tree));
  const otherEntries = entriesByPath(flattenTree(vfs, repoPath, otherCommit.tree));

  const allPaths = new Set([...baseEntries.keys(), ...currentEntries.keys(), ...otherEntries.keys()]);
  const merged: GitIndex = [];
  const conflicts: string[] = [];

  for (const path of allPaths) {
    const base = baseEntries.get(path);
    const current = currentEntries.get(path);
    const other = otherEntries.get(path);

    const currentChanged = current?.blobHash !== base?.blobHash;
    const otherChanged = other?.blobHash !== base?.blobHash;

    if (!currentChanged) {
      if (other) merged.push(other);
      continue;
    }
    if (!otherChanged) {
      if (current) merged.push(current);
      continue;
    }
    if (current && other && current.blobHash === other.blobHash && current.mode === other.mode) {
      merged.push(current);
      continue;
    }
    conflicts.push(path);
  }

  if (conflicts.length > 0) {
    return { type: "conflict", paths: conflicts.sort((a, b) => a.localeCompare(b)) };
  }

  const treeHash = buildTreeFromIndex(vfs, repoPath, merged);
  const { hash } = createCommit(vfs, repoPath, treeHash, message, [currentHash, otherHash]);
  writeBranchHash(vfs, repoPath, currentBranch, hash);
  writeIndex(vfs, repoPath, merged);
  materializeTree(vfs, repoPath, treeHash);
  return { type: "merged", commitHash: hash };
}
