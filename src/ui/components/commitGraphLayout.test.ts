import { describe, expect, it } from "vitest";

import type { CommitGraph, CommitGraphNode } from "../../engine/git";
import { layoutCommitGraph } from "./commitGraphLayout";

function node(overrides: Partial<CommitGraphNode> & { hash: string }): CommitGraphNode {
  return { message: overrides.hash, parents: [], sequence: 0, branches: [], ...overrides };
}

describe("layoutCommitGraph", () => {
  it("returns no rows for an empty graph", () => {
    const graph: CommitGraph = { nodes: [], headBranch: undefined };

    expect(layoutCommitGraph(graph)).toEqual([]);
  });

  it("keeps a linear history in a single lane", () => {
    const c1 = node({ hash: "c1", sequence: 0 });
    const c2 = node({ hash: "c2", parents: ["c1"], sequence: 1, branches: ["main"] });
    const graph: CommitGraph = { nodes: [c2, c1], headBranch: "main" };

    const rows = layoutCommitGraph(graph);

    expect(rows.map((row) => ({ hash: row.node.hash, lane: row.lane, activeLanes: row.activeLanes }))).toEqual([
      { hash: "c2", lane: 0, activeLanes: [0] },
      { hash: "c1", lane: 0, activeLanes: [0] },
    ]);
  });

  it("assigns diverged branches to distinct lanes, prioritizing the HEAD branch for lane 0", () => {
    const base = node({ hash: "base", sequence: 0 });
    const main = node({ hash: "main", parents: ["base"], sequence: 1, branches: ["main"] });
    const feature = node({ hash: "feature", parents: ["base"], sequence: 1, branches: ["feature"] });
    const graph: CommitGraph = { nodes: [feature, main, base], headBranch: "main" };

    const rows = layoutCommitGraph(graph);

    expect(rows.map((row) => ({ hash: row.node.hash, lane: row.lane }))).toEqual([
      { hash: "feature", lane: 1 },
      { hash: "main", lane: 0 },
      { hash: "base", lane: 0 },
    ]);
    expect(rows.map((row) => row.activeLanes)).toEqual([[0, 1], [0, 1], [0]]);
  });

  it("draws a diamond for a merge commit: diverge into two lanes, then converge back to one", () => {
    const base = node({ hash: "base", sequence: 0 });
    const main = node({ hash: "main", parents: ["base"], sequence: 1 });
    const feature = node({ hash: "feature", parents: ["base"], sequence: 1 });
    const merge = node({
      hash: "merge",
      parents: ["main", "feature"],
      sequence: 2,
      branches: ["main"],
    });
    const graph: CommitGraph = { nodes: [merge, main, feature, base], headBranch: "main" };

    const rows = layoutCommitGraph(graph);

    expect(rows.map((row) => ({ hash: row.node.hash, lane: row.lane }))).toEqual([
      { hash: "merge", lane: 0 },
      { hash: "main", lane: 0 },
      { hash: "feature", lane: 1 },
      { hash: "base", lane: 0 },
    ]);
    expect(rows.map((row) => row.activeLanes)).toEqual([[0, 1], [0, 1], [0, 1], [0]]);
  });

  it("merges a commit pointed at by multiple branches into a single lane", () => {
    const shared = node({ hash: "shared", sequence: 0, branches: ["feature", "main"] });
    const graph: CommitGraph = { nodes: [shared], headBranch: "main" };

    const rows = layoutCommitGraph(graph);

    expect(rows).toEqual([{ node: shared, lane: 0, activeLanes: [0] }]);
  });
});
