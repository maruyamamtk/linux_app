import type { VirtualFileSystem } from "../vfs";
import { readObject } from "./objectStore";
import { listBranches, readBranchHash, readHeadBranch } from "./refs";
import type { GitCommitObject } from "./types";

/** コミットグラフの1ノード(docs/git-simulator-design.md 10章)。 */
export interface CommitGraphNode {
  hash: string;
  message: string;
  /** 通常のcommitは1つ、mergeコミットは2つ、initial commitは0個。 */
  parents: string[];
  sequence: number;
  /** このコミットを直接指しているブランチ名の一覧(name昇順)。どのブランチも指していなければ空配列。 */
  branches: string[];
}

export interface CommitGraph {
  /** sequence降順(新しい順、`git log`と同じ順序)。sequenceが同じ場合はhash昇順で安定させる。 */
  nodes: CommitGraphNode[];
  /** 現在のHEADが指すブランチ名。detached HEAD(未対応)や空リポジトリの場合はundefined。 */
  headBranch: string | undefined;
}

/**
 * 現在のリポジトリの全ブランチref(`refs/heads/*`)から到達可能なコミットを`parents`でたどって
 * 収集し、コミットをノード・親子関係をエッジとする読み取り専用のグラフを構築する
 * (docs/git-simulator-design.md 10章)。コマンド実行のたびにVFSから再構築する単純な方式であり、
 * 専用の差分更新ロジックは持たない(演習1回あたりのコミット数は多くても十数個程度のため)。
 */
export function buildCommitGraph(vfs: VirtualFileSystem, repoPath: string): CommitGraph {
  const branchTips = new Map<string, string[]>();
  for (const branch of listBranches(vfs, repoPath)) {
    const hash = readBranchHash(vfs, repoPath, branch);
    if (!hash) continue;
    const branches = branchTips.get(hash) ?? [];
    branches.push(branch);
    branchTips.set(hash, branches);
  }

  const nodes = new Map<string, CommitGraphNode>();
  const stack = [...branchTips.keys()];
  while (stack.length > 0) {
    const hash = stack.pop()!;
    if (nodes.has(hash)) continue;
    const commit = readObject(vfs, repoPath, hash) as GitCommitObject;
    nodes.set(hash, {
      hash,
      message: commit.message,
      parents: commit.parents,
      sequence: commit.sequence,
      branches: (branchTips.get(hash) ?? []).slice().sort((a, b) => a.localeCompare(b)),
    });
    stack.push(...commit.parents);
  }

  const sortedNodes = Array.from(nodes.values()).sort((a, b) =>
    a.sequence !== b.sequence ? b.sequence - a.sequence : a.hash.localeCompare(b.hash),
  );

  let headBranch: string | undefined;
  try {
    headBranch = readHeadBranch(vfs, repoPath);
  } catch {
    headBranch = undefined;
  }

  return { nodes: sortedNodes, headBranch };
}
