import { VfsError } from "./errors";
import { hasPermission, formatMode } from "./permissions";
import { basename, DEV_NULL_PATH, dirname, joinPath, normalizePath, splitPath } from "./path";
import { diffTree, type VfsDiffEntry } from "./snapshot";
import { applyOwnership, cloneNode, createDirectory, createFile } from "./tree";
import type { VfsDirectoryNode, VfsNode, VfsNodeType, VfsSnapshot, VfsUser } from "./types";

export interface VfsStat {
  path: string;
  name: string;
  type: VfsNodeType;
  size: number;
  owner: string;
  group: string;
  mode: number;
  formattedMode: string;
}

function toStat(path: string, node: VfsNode): VfsStat {
  const size =
    node.type === "file" ? (node.size ?? node.content.length) : Object.keys(node.children).length;
  return {
    path: normalizePath(path),
    name: node.name,
    type: node.type,
    size,
    owner: node.owner,
    group: node.group,
    mode: node.mode,
    formattedMode: formatMode(node),
  };
}

/**
 * 演習用の仮想ファイルシステム。パス解決・CRUD操作・パーミッション判定・
 * スナップショットの読み込み/リセット/差分取得を提供する。
 */
export class VirtualFileSystem {
  private tree!: VfsDirectoryNode;
  private initialTree!: VfsDirectoryNode;
  private user: VfsUser;

  constructor(snapshot: VfsSnapshot, user: VfsUser) {
    this.user = user;
    this.load(snapshot);
  }

  setUser(user: VfsUser): void {
    this.user = user;
  }

  getUser(): VfsUser {
    return this.user;
  }

  /** 新しいスナップショットを読み込み、現在の状態・初期状態の両方を置き換える。 */
  load(snapshot: VfsSnapshot): void {
    this.initialTree = cloneNode(snapshot.root);
    this.tree = cloneNode(snapshot.root);
  }

  /** 読み込み時のスナップショットの状態まで、現在の状態を巻き戻す。 */
  reset(): void {
    this.tree = cloneNode(this.initialTree);
  }

  /** 読み込み時のスナップショットと現在の状態の差分(追加/削除/変更)を返す。 */
  diff(): VfsDiffEntry[] {
    return diffTree(this.initialTree, this.tree);
  }

  /**
   * 現在の木構造のクローンを返す。採点エンジンが学習者/模範解答それぞれの
   * `VirtualFileSystem` インスタンスを実行後に比較する用途を想定している。
   */
  getRootNode(): VfsDirectoryNode {
    return cloneNode(this.tree);
  }

  private resolve(path: string): { node: VfsNode; parent: VfsDirectoryNode | null } {
    const normalized = normalizePath(path);
    const segments = splitPath(normalized);
    let current: VfsNode = this.tree;
    let parent: VfsDirectoryNode | null = null;

    for (const segment of segments) {
      if (current.type !== "directory") {
        throw new VfsError("ENOTDIR", normalized);
      }
      if (!hasPermission(current, this.user, "execute")) {
        throw new VfsError("EACCES", normalized);
      }
      const child: VfsNode | undefined = current.children[segment];
      if (!child) {
        throw new VfsError("ENOENT", normalized);
      }
      parent = current;
      current = child;
    }

    return { node: current, parent };
  }

  exists(path: string): boolean {
    try {
      this.resolve(path);
      return true;
    } catch (error) {
      if (error instanceof VfsError) return false;
      throw error;
    }
  }

  stat(path: string): VfsStat {
    const { node } = this.resolve(path);
    return toStat(path, node);
  }

  readdir(path: string): VfsStat[] {
    const normalized = normalizePath(path);
    const { node } = this.resolve(normalized);
    if (node.type !== "directory") throw new VfsError("ENOTDIR", normalized);
    if (!hasPermission(node, this.user, "read")) throw new VfsError("EACCES", normalized);

    return Object.values(node.children)
      .map((child) => toStat(joinPath(normalized, child.name), child))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  readFile(path: string): string {
    const normalized = normalizePath(path);
    if (normalized === DEV_NULL_PATH) return "";
    const { node } = this.resolve(normalized);
    if (node.type !== "file") throw new VfsError("EISDIR", normalized);
    if (!hasPermission(node, this.user, "read")) throw new VfsError("EACCES", normalized);
    return node.content;
  }

  /** `/dev/null` への書き込みは特殊デバイスファイルの挙動として常に破棄する。 */
  writeFile(path: string, content: string, options: { mode?: number } = {}): void {
    const normalized = normalizePath(path);
    if (normalized === DEV_NULL_PATH) return;

    if (this.exists(normalized)) {
      const { node } = this.resolve(normalized);
      if (node.type !== "file") throw new VfsError("EISDIR", normalized);
      if (!hasPermission(node, this.user, "write")) throw new VfsError("EACCES", normalized);
      node.content = content;
      return;
    }

    const parentPath = dirname(normalized);
    const { node: parent } = this.resolve(parentPath);
    if (parent.type !== "directory") throw new VfsError("ENOTDIR", parentPath);
    if (!hasPermission(parent, this.user, "write")) throw new VfsError("EACCES", parentPath);

    const name = basename(normalized);
    parent.children[name] = createFile(name, content, {
      owner: this.user.name,
      group: this.user.groups[0] ?? this.user.name,
      mode: options.mode,
    });
  }

  appendFile(path: string, content: string): void {
    const existing = this.exists(path) ? this.readFile(path) : "";
    this.writeFile(path, existing + content);
  }

  mkdir(path: string, options: { recursive?: boolean; mode?: number } = {}): void {
    const normalized = normalizePath(path);

    if (normalized === "/") {
      if (options.recursive) return;
      throw new VfsError("EEXIST", normalized);
    }

    const parentPath = dirname(normalized);
    const name = basename(normalized);

    if (options.recursive && !this.exists(parentPath)) {
      this.mkdir(parentPath, options);
    }

    const { node: parent } = this.resolve(parentPath);
    if (parent.type !== "directory") throw new VfsError("ENOTDIR", parentPath);

    if (name in parent.children) {
      if (options.recursive && parent.children[name].type === "directory") return;
      throw new VfsError("EEXIST", normalized);
    }

    if (!hasPermission(parent, this.user, "write")) throw new VfsError("EACCES", parentPath);

    parent.children[name] = createDirectory(
      name,
      {},
      {
        owner: this.user.name,
        group: this.user.groups[0] ?? this.user.name,
        mode: options.mode,
      },
    );
  }

  remove(path: string, options: { recursive?: boolean } = {}): void {
    const normalized = normalizePath(path);
    if (normalized === "/") throw new VfsError("EACCES", normalized, "cannot remove root");

    const parentPath = dirname(normalized);
    const { node: parent } = this.resolve(parentPath);
    if (parent.type !== "directory") throw new VfsError("ENOTDIR", parentPath);

    const name = basename(normalized);
    const target = parent.children[name];
    if (!target) throw new VfsError("ENOENT", normalized);

    const isNonEmptyDir = target.type === "directory" && Object.keys(target.children).length > 0;
    if (isNonEmptyDir && !options.recursive) {
      throw new VfsError("ENOTEMPTY", normalized);
    }
    if (!hasPermission(parent, this.user, "write")) throw new VfsError("EACCES", parentPath);

    delete parent.children[name];
  }

  move(sourcePath: string, destPath: string): void {
    const normalizedSource = normalizePath(sourcePath);
    if (normalizedSource === "/") {
      throw new VfsError("EACCES", normalizedSource, "cannot move root");
    }

    const { node: sourceNode } = this.resolve(normalizedSource);
    const sourceParentPath = dirname(normalizedSource);
    const { node: sourceParent } = this.resolve(sourceParentPath);
    if (sourceParent.type !== "directory") throw new VfsError("ENOTDIR", sourceParentPath);
    if (!hasPermission(sourceParent, this.user, "write")) {
      throw new VfsError("EACCES", sourceParentPath);
    }

    const finalDestPath = this.resolveDestination(destPath, normalizedSource);
    if (finalDestPath === normalizedSource) return;
    if (finalDestPath.startsWith(`${normalizedSource}/`)) {
      throw new VfsError("EINVAL", finalDestPath, "cannot move a directory into itself");
    }

    const destParentPath = dirname(finalDestPath);
    const { node: destParent } = this.resolve(destParentPath);
    if (destParent.type !== "directory") throw new VfsError("ENOTDIR", destParentPath);

    const destName = basename(finalDestPath);
    if (destName in destParent.children) throw new VfsError("EEXIST", finalDestPath);

    if (!hasPermission(destParent, this.user, "write")) {
      throw new VfsError("EACCES", destParentPath);
    }

    const movedNode = cloneNode(sourceNode);
    movedNode.name = destName;
    destParent.children[destName] = movedNode;
    delete sourceParent.children[basename(normalizedSource)];
  }

  copy(sourcePath: string, destPath: string, options: { recursive?: boolean } = {}): void {
    const normalizedSource = normalizePath(sourcePath);
    const { node: sourceNode } = this.resolve(normalizedSource);

    if (sourceNode.type === "directory" && !options.recursive) {
      throw new VfsError("EISDIR", normalizedSource, "use recursive option to copy a directory");
    }
    if (!hasPermission(sourceNode, this.user, "read")) {
      throw new VfsError("EACCES", normalizedSource);
    }

    const finalDestPath = this.resolveDestination(destPath, normalizedSource);
    if (finalDestPath === normalizedSource) throw new VfsError("EEXIST", finalDestPath);
    if (sourceNode.type === "directory" && finalDestPath.startsWith(`${normalizedSource}/`)) {
      throw new VfsError("EINVAL", finalDestPath, "cannot copy a directory into itself");
    }

    const destParentPath = dirname(finalDestPath);
    const { node: destParent } = this.resolve(destParentPath);
    if (destParent.type !== "directory") throw new VfsError("ENOTDIR", destParentPath);

    const destName = basename(finalDestPath);
    if (destName in destParent.children) throw new VfsError("EEXIST", finalDestPath);

    if (!hasPermission(destParent, this.user, "write")) {
      throw new VfsError("EACCES", destParentPath);
    }

    const copiedNode = cloneNode(sourceNode);
    copiedNode.name = destName;
    applyOwnership(copiedNode, this.user.name, this.user.groups[0] ?? this.user.name);
    destParent.children[destName] = copiedNode;
  }

  chmod(path: string, mode: number): void {
    const normalized = normalizePath(path);
    const { node } = this.resolve(normalized);
    if (!this.user.isRoot && node.owner !== this.user.name) {
      throw new VfsError("EACCES", normalized, "only the owner or root can change mode");
    }
    node.mode = mode;
  }

  chown(path: string, owner: string, group?: string): void {
    const normalized = normalizePath(path);
    const { node } = this.resolve(normalized);
    if (!this.user.isRoot) {
      throw new VfsError("EACCES", normalized, "only root can change ownership");
    }
    node.owner = owner;
    if (group) node.group = group;
  }

  /** mv/cpの移動先パスを解決する。既存のディレクトリを指す場合はその配下に元の名前で配置する。 */
  private resolveDestination(destPath: string, sourcePath: string): string {
    const normalizedDest = normalizePath(destPath);
    if (this.exists(normalizedDest)) {
      const { node } = this.resolve(normalizedDest);
      if (node.type === "directory") {
        return joinPath(normalizedDest, basename(sourcePath));
      }
    }
    return normalizedDest;
  }
}
