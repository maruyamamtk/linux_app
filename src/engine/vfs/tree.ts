import type { VfsDirectoryNode, VfsFileNode, VfsNode } from "./types";

export function createFile(
  name: string,
  content = "",
  options: Partial<Pick<VfsFileNode, "owner" | "group" | "mode" | "size">> = {},
): VfsFileNode {
  return {
    type: "file",
    name,
    content,
    owner: options.owner ?? "study",
    group: options.group ?? "study",
    mode: options.mode ?? 0o644,
    ...(options.size !== undefined ? { size: options.size } : {}),
  };
}

export function createDirectory(
  name: string,
  children: Record<string, VfsNode> = {},
  options: Partial<Pick<VfsDirectoryNode, "owner" | "group" | "mode">> = {},
): VfsDirectoryNode {
  return {
    type: "directory",
    name,
    children,
    owner: options.owner ?? "study",
    group: options.group ?? "study",
    mode: options.mode ?? 0o755,
  };
}

export function cloneNode<T extends VfsNode>(node: T): T {
  if (node.type === "file") {
    return { ...node } as T;
  }

  const children: Record<string, VfsNode> = {};
  for (const [key, child] of Object.entries(node.children)) {
    children[key] = cloneNode(child);
  }

  return { ...node, children } as T;
}
