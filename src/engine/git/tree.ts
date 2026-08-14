import { dirname, joinPath } from "../vfs";
import type { VirtualFileSystem } from "../vfs";
import { GitError } from "./errors";
import { readObject, writeObject } from "./objectStore";
import { GIT_DIR } from "./repo";
import type { GitBlobObject, GitFileMode, GitIndex, GitTreeEntry, GitTreeObject } from "./types";

/**
 * Gitのtree entry mode("100644"/"100755")をVFSの9bitパーミッション値(0o644/0o755)へ変換する。
 * VfsNode.modeは純粋な権限bitのみを保持する規約のため、"100644"をそのまま8進数としてparseIntすると
 * 上位のファイル種別bit(0o100000)まで含んでしまい規約に反する。
 */
function gitModeToVfsMode(mode: GitFileMode): number {
  return mode === "100755" ? 0o755 : 0o644;
}

interface TreeBuildNode {
  files: Map<string, GitIndex[number]>;
  dirs: Map<string, TreeBuildNode>;
}

function insertEntry(root: TreeBuildNode, entry: GitIndex[number]): void {
  const segments = entry.path.split("/").filter((segment) => segment.length > 0);
  let node = root;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    let child = node.dirs.get(segment);
    if (!child) {
      child = { files: new Map(), dirs: new Map() };
      node.dirs.set(segment, child);
    }
    node = child;
  }
  node.files.set(segments[segments.length - 1], entry);
}

function writeTreeNode(vfs: VirtualFileSystem, repoPath: string, node: TreeBuildNode): string {
  const entries: GitTreeEntry[] = [];

  for (const [name, entry] of node.files) {
    entries.push({ name, mode: entry.mode, type: "blob", hash: entry.blobHash });
  }
  for (const [name, child] of node.dirs) {
    entries.push({ name, mode: "040000", type: "tree", hash: writeTreeNode(vfs, repoPath, child) });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const tree: GitTreeObject = { type: "tree", entries };
  return writeObject(vfs, repoPath, tree);
}

/** `.git/index`(またはそれ相当のフラットなエントリ一覧)からtreeオブジェクト群を組み立てる(3.4節)。 */
export function buildTreeFromIndex(vfs: VirtualFileSystem, repoPath: string, index: GitIndex): string {
  const root: TreeBuildNode = { files: new Map(), dirs: new Map() };
  for (const entry of index) insertEntry(root, entry);
  return writeTreeNode(vfs, repoPath, root);
}

/** tree階層を`GitIndex`と同じ形(パス→blobHash)に平坦化する。`treeHash`が無い(unbornブランチ)場合は空。 */
export function flattenTree(
  vfs: VirtualFileSystem,
  repoPath: string,
  treeHash: string | undefined,
  prefix = "",
): GitIndex {
  if (!treeHash) return [];

  const object = readObject(vfs, repoPath, treeHash);
  if (object.type !== "tree") throw new GitError(`not a tree object: ${treeHash}`);

  const result: GitIndex = [];
  for (const entry of object.entries) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.type === "blob") {
      result.push({ path, mode: entry.mode as GitIndex[number]["mode"], blobHash: entry.hash });
    } else {
      result.push(...flattenTree(vfs, repoPath, entry.hash, path));
    }
  }
  return result;
}

/** ワークツリー上の全ファイルを`.git`を除いて相対パスの一覧として列挙する。 */
export function listWorktreeFiles(
  vfs: VirtualFileSystem,
  repoPath: string,
  dir: string = repoPath,
  prefix = "",
): string[] {
  const result: string[] = [];
  for (const entry of vfs.readdir(dir)) {
    if (prefix === "" && entry.name === GIT_DIR) continue;
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.type === "directory") {
      result.push(...listWorktreeFiles(vfs, repoPath, joinPath(dir, entry.name), relativePath));
    } else {
      result.push(relativePath);
    }
  }
  return result;
}

/** 再帰的に空になったディレクトリ(`.git`を除く)を削除する。checkout/merge後のワークツリー整理用。 */
function removeEmptyDirectories(
  vfs: VirtualFileSystem,
  dir: string,
  isRoot: boolean,
): void {
  for (const entry of vfs.readdir(dir)) {
    if (isRoot && entry.name === GIT_DIR) continue;
    if (entry.type === "directory") {
      removeEmptyDirectories(vfs, joinPath(dir, entry.name), false);
    }
  }
  if (!isRoot && vfs.readdir(dir).length === 0) {
    vfs.remove(dir, { recursive: false });
  }
}

/**
 * ワークツリーを`treeHash`の内容に再展開する(materialize)。tree側に存在しないファイルは
 * 削除し、tree側の内容でファイルを上書き/新規作成する(5.7節)。
 */
export function materializeTree(
  vfs: VirtualFileSystem,
  repoPath: string,
  treeHash: string | undefined,
): void {
  const targetEntries = flattenTree(vfs, repoPath, treeHash);
  const desiredPaths = new Set(targetEntries.map((entry) => entry.path));

  for (const existingPath of listWorktreeFiles(vfs, repoPath)) {
    if (!desiredPaths.has(existingPath)) {
      vfs.remove(joinPath(repoPath, existingPath), { recursive: false });
    }
  }

  for (const entry of targetEntries) {
    const blob = readObject(vfs, repoPath, entry.blobHash) as GitBlobObject;
    const fullPath = joinPath(repoPath, entry.path);
    const parentDir = dirname(fullPath);
    if (!vfs.exists(parentDir)) vfs.mkdir(parentDir, { recursive: true });
    vfs.writeFile(fullPath, blob.content, { mode: gitModeToVfsMode(entry.mode) });
  }

  removeEmptyDirectories(vfs, repoPath, true);
}
