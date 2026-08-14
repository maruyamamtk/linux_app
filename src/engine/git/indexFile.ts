import { joinPath } from "../vfs";
import type { VirtualFileSystem } from "../vfs";
import { gitDir } from "./repo";
import type { GitIndex, GitIndexEntry } from "./types";

function indexPath(repoPath: string): string {
  return joinPath(gitDir(repoPath), "index");
}

export function readIndex(vfs: VirtualFileSystem, repoPath: string): GitIndex {
  const content = vfs.readFile(indexPath(repoPath)).trim();
  if (content.length === 0) return [];
  return JSON.parse(content) as GitIndex;
}

export function writeIndex(vfs: VirtualFileSystem, repoPath: string, index: GitIndex): void {
  const sorted = [...index].sort((a, b) => a.path.localeCompare(b.path));
  vfs.writeFile(indexPath(repoPath), `${JSON.stringify(sorted)}\n`);
}

/** 既存エントリがあれば`blobHash`/`mode`を上書きし、無ければ追加する(3.4節)。 */
export function upsertIndexEntry(index: GitIndex, entry: GitIndexEntry): GitIndex {
  return [...index.filter((existing) => existing.path !== entry.path), entry];
}

export function removeIndexEntry(index: GitIndex, path: string): GitIndex {
  return index.filter((existing) => existing.path !== path);
}
