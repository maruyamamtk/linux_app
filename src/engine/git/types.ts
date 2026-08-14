/** docs/git-simulator-design.md 3.1節: blob/tree/commitの3種のGitオブジェクト。 */
export interface GitBlobObject {
  type: "blob";
  /** ファイル内容そのもの。 */
  content: string;
}

/** 通常ファイル / 実行可能ファイル / ディレクトリ(実Gitのモード文字列を踏襲)。 */
export type GitFileMode = "100644" | "100755";
export type GitTreeEntryMode = GitFileMode | "040000";

export interface GitTreeEntry {
  name: string;
  mode: GitTreeEntryMode;
  type: "blob" | "tree";
  hash: string;
}

export interface GitTreeObject {
  type: "tree";
  /** name昇順にソートして保持する(3.2節: ハッシュの決定性のため)。 */
  entries: GitTreeEntry[];
}

export interface GitCommitObject {
  type: "commit";
  /** GitTreeObjectのハッシュ。 */
  tree: string;
  /** 通常のcommitは1つ、mergeコミットは2つ、initial commitは0個。 */
  parents: string[];
  /** "study <study@localhost>" 形式(3.4節)。author/committerは区別しない。 */
  author: string;
  message: string;
  /** 実時刻ではなく決定的な論理時刻(8章)。親の最大sequence+1、initial commitは0。 */
  sequence: number;
}

export type GitObject = GitBlobObject | GitTreeObject | GitCommitObject;

export interface GitIndexEntry {
  /** リポジトリルートからの相対パス。例: "practice/memo.txt" */
  path: string;
  mode: GitFileMode;
  /** ステージ時点のファイル内容から計算したblobハッシュ。 */
  blobHash: string;
}

export type GitIndex = GitIndexEntry[];

/** `.git/config`(3.6節)。リモート名からVFS絶対パスへのマッピングのみを保持する(`origin`1つのみ対応)。 */
export interface GitConfig {
  remotes: Record<string, string>;
}
