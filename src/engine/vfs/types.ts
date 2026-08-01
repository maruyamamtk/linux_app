export type VfsNodeType = "file" | "directory";

interface VfsNodeBase {
  name: string;
  /** UNIX風の9bitパーミッション(owner/group/other × rwx)。例: 0o755, 0o600 */
  mode: number;
  owner: string;
  group: string;
}

export interface VfsFileNode extends VfsNodeBase {
  type: "file";
  content: string;
  /**
   * ダミー実行ファイル(/bin配下等)のように、実際のcontentを持たずサイズだけを
   * 持たせたいノード向けの明示サイズ。未指定の場合はcontent.lengthを使用する。
   */
  size?: number;
}

export interface VfsDirectoryNode extends VfsNodeBase {
  type: "directory";
  children: Record<string, VfsNode>;
}

export type VfsNode = VfsFileNode | VfsDirectoryNode;

export interface VfsUser {
  name: string;
  /** 所属グループ。groups[0]が新規作成ノードのプライマリグループとして使われる。 */
  groups: string[];
  isRoot?: boolean;
}

export interface VfsSnapshot {
  id: string;
  description?: string;
  root: VfsDirectoryNode;
}
