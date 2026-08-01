import { joinPath } from "./path";
import type { VfsDirectoryNode, VfsNode, VfsNodeType } from "./types";

export type VfsDiffChangeType = "added" | "removed" | "modified";

export interface VfsDiffEntry {
  path: string;
  change: VfsDiffChangeType;
  nodeType: VfsNodeType;
}

function metadataEqual(a: VfsNode, b: VfsNode): boolean {
  return a.owner === b.owner && a.group === b.group && a.mode === b.mode;
}

/**
 * 初期スナップショットと現在の状態を比較し、追加/削除/変更されたパスの一覧を返す。
 * 採点エンジンが「実行後のVFS状態」を突き合わせる際の基礎データとなる。
 */
export function diffTree(
  before: VfsDirectoryNode,
  after: VfsDirectoryNode,
  basePath = "/",
): VfsDiffEntry[] {
  const entries: VfsDiffEntry[] = [];
  const names = new Set([...Object.keys(before.children), ...Object.keys(after.children)]);

  for (const name of Array.from(names).sort()) {
    const childPath = joinPath(basePath, name);
    const beforeChild = before.children[name];
    const afterChild = after.children[name];

    if (!beforeChild && afterChild) {
      entries.push({ path: childPath, change: "added", nodeType: afterChild.type });
      continue;
    }
    if (beforeChild && !afterChild) {
      entries.push({ path: childPath, change: "removed", nodeType: beforeChild.type });
      continue;
    }
    if (!beforeChild || !afterChild) continue;

    if (beforeChild.type === "directory" && afterChild.type === "directory") {
      if (!metadataEqual(beforeChild, afterChild)) {
        entries.push({ path: childPath, change: "modified", nodeType: "directory" });
      }
      entries.push(...diffTree(beforeChild, afterChild, childPath));
      continue;
    }

    if (beforeChild.type === "file" && afterChild.type === "file") {
      if (!metadataEqual(beforeChild, afterChild) || beforeChild.content !== afterChild.content) {
        entries.push({ path: childPath, change: "modified", nodeType: "file" });
      }
      continue;
    }

    // file <-> directory の入れ替わり
    entries.push({ path: childPath, change: "modified", nodeType: afterChild.type });
  }

  return entries;
}
