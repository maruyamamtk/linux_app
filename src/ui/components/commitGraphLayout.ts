import type { CommitGraph, CommitGraphNode } from "../../engine/git";

/** `CommitGraphView`が描画する1行分のレイアウト情報。 */
export interface CommitGraphRow {
  node: CommitGraphNode;
  /** このコミットのドットを描画するレーン番号(0始まり、左から順)。 */
  lane: number;
  /** この行を通過するレーン番号の一覧(自身のレーンを含む、縦線描画用)。昇順。 */
  activeLanes: number[];
}

/**
 * コミットを`graph.nodes`の順序(sequence降順、新しい順)のまま行として並べ、各行に描画用の
 * レーン番号を割り当てる(docs/git-simulator-design.md 10章: 具体的なレイアウトアルゴリズムは
 * 画面実装フェーズで決定)。各ブランチの最新コミットをレーンの起点とし、親をたどるたびに
 * 同じレーンを引き継ぐ、「一番左の空きレーンに割り当てる」単純な方式。マージコミットの
 * 2つ目以降の親には新しいレーンを割り当て、複数のレーンが同じ親を待つ状態になった場合は
 * 1つを残して残りを解放する(ブランチの合流)。演習1回あたりのコミット数は多くても十数個・
 * ブランチ数も少数(2〜3程度)という想定規模であれば十分読みやすいレイアウトになる。
 */
export function layoutCommitGraph(graph: CommitGraph): CommitGraphRow[] {
  const nodesByHash = new Map(graph.nodes.map((node) => [node.hash, node]));

  // レーンの起点(ブランチのtipコミット)を安定した順序で決める: HEADブランチを最優先、
  // 次にブランチ名の昇順。同じコミットを複数のブランチが指す場合は1つのレーンにまとめる。
  const tipHashes: string[] = [];
  const seenTips = new Set<string>();
  for (const node of graph.nodes) {
    if (node.branches.length === 0 || seenTips.has(node.hash)) continue;
    seenTips.add(node.hash);
    tipHashes.push(node.hash);
  }
  tipHashes.sort((hashA, hashB) => {
    const nodeA = nodesByHash.get(hashA)!;
    const nodeB = nodesByHash.get(hashB)!;
    const aIsHead = nodeA.branches.includes(graph.headBranch ?? "");
    const bIsHead = nodeB.branches.includes(graph.headBranch ?? "");
    if (aIsHead !== bIsHead) return aIsHead ? -1 : 1;
    return nodeA.branches[0].localeCompare(nodeB.branches[0]);
  });

  // lanes[i] は「レーンiが次に迎えるべきコミットのハッシュ」(まだ描画していない祖先)。
  const lanes: (string | null)[] = [];
  function laneFor(hash: string): number {
    const existing = lanes.indexOf(hash);
    if (existing !== -1) return existing;
    const free = lanes.indexOf(null);
    if (free !== -1) {
      lanes[free] = hash;
      return free;
    }
    lanes.push(hash);
    return lanes.length - 1;
  }
  for (const hash of tipHashes) laneFor(hash);

  function activeLaneIndices(): number[] {
    const active: number[] = [];
    lanes.forEach((value, index) => {
      if (value !== null) active.push(index);
    });
    return active;
  }

  const rows: CommitGraphRow[] = [];
  for (const node of graph.nodes) {
    const lane = laneFor(node.hash);
    const before = activeLaneIndices();

    if (node.parents.length === 0) {
      lanes[lane] = null;
    } else {
      lanes[lane] = node.parents[0];
      for (const parentHash of node.parents.slice(1)) {
        if (!lanes.includes(parentHash)) laneFor(parentHash);
      }
      // 複数のレーンが同じ親を待つ状態(ブランチの合流)になった場合、1つだけ残す。
      let kept = false;
      for (let i = 0; i < lanes.length; i++) {
        if (lanes[i] !== node.parents[0]) continue;
        if (kept) lanes[i] = null;
        else kept = true;
      }
    }

    const after = activeLaneIndices();
    const activeLanes = Array.from(new Set([...before, lane, ...after])).sort((a, b) => a - b);
    rows.push({ node, lane, activeLanes });
  }

  return rows;
}
