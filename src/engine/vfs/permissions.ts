import type { VfsNode, VfsUser } from "./types";

export type VfsAction = "read" | "write" | "execute";

const ACTION_BIT: Record<VfsAction, number> = {
  read: 0b100,
  write: 0b010,
  execute: 0b001,
};

/** root(isRoot)は全操作を無条件に許可する。それ以外はowner/group/otherの該当bitで判定する。 */
export function hasPermission(node: VfsNode, user: VfsUser, action: VfsAction): boolean {
  if (user.isRoot) return true;

  const bit = ACTION_BIT[action];

  if (node.owner === user.name) {
    return ((node.mode >> 6) & bit) === bit;
  }
  if (user.groups.includes(node.group)) {
    return ((node.mode >> 3) & bit) === bit;
  }
  return (node.mode & bit) === bit;
}

/** `ls -l`風の "drwxr-xr-x" 形式の文字列を返す。 */
export function formatMode(node: VfsNode): string {
  const typeChar = node.type === "directory" ? "d" : "-";
  const parts = [node.mode >> 6, node.mode >> 3, node.mode].map((part) => part & 0b111);
  const rendered = parts
    .map(
      (part) => `${part & 0b100 ? "r" : "-"}${part & 0b010 ? "w" : "-"}${part & 0b001 ? "x" : "-"}`,
    )
    .join("");
  return `${typeChar}${rendered}`;
}
