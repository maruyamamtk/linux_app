import { describe, expect, it } from "vitest";

import { createCommit } from "./commit";
import { buildCommitGraph } from "./graph";
import { upsertIndexEntry } from "./indexFile";
import { readObject, writeObject } from "./objectStore";
import { writeBranchHash } from "./refs";
import { buildRepo, REPO_PATH } from "./testFixtures";
import { buildTreeFromIndex, flattenTree } from "./tree";
import type { GitCommitObject, GitIndex } from "./types";

type Vfs = ReturnType<typeof buildRepo>;

/** ベースとなる親コミットのtreeに`files`を重ねた新規コミットを作成する(worktreeには触れない)。 */
function stageAndCommit(
  vfs: Vfs,
  files: Record<string, string>,
  message: string,
  parents: string[],
): string {
  let index: GitIndex =
    parents.length > 0
      ? flattenTree(vfs, REPO_PATH, (readObject(vfs, REPO_PATH, parents[0]) as GitCommitObject).tree)
      : [];
  for (const [path, content] of Object.entries(files)) {
    const blobHash = writeObject(vfs, REPO_PATH, { type: "blob", content });
    index = upsertIndexEntry(index, { path, mode: "100644", blobHash });
  }
  const treeHash = buildTreeFromIndex(vfs, REPO_PATH, index);
  return createCommit(vfs, REPO_PATH, treeHash, message, parents).hash;
}

describe("buildCommitGraph", () => {
  it("returns an empty node list for a freshly initialized repo (unborn HEAD)", () => {
    const vfs = buildRepo();

    const graph = buildCommitGraph(vfs, REPO_PATH);

    expect(graph.nodes).toEqual([]);
    expect(graph.headBranch).toBe("main");
  });

  it("orders a linear history from newest to oldest and attaches the branch to its tip only", () => {
    const vfs = buildRepo();
    const first = stageAndCommit(vfs, { "a.txt": "a\n" }, "first", []);
    writeBranchHash(vfs, REPO_PATH, "main", first);
    const second = stageAndCommit(vfs, { "b.txt": "b\n" }, "second", [first]);
    writeBranchHash(vfs, REPO_PATH, "main", second);

    const graph = buildCommitGraph(vfs, REPO_PATH);

    expect(graph.nodes.map((node) => node.hash)).toEqual([second, first]);
    expect(graph.nodes[0]).toMatchObject({ message: "second", parents: [first], branches: ["main"] });
    expect(graph.nodes[1]).toMatchObject({ message: "first", parents: [], branches: [] });
    expect(graph.headBranch).toBe("main");
  });

  it("includes commits reachable from every branch, labeling each tip with its branch name", () => {
    const vfs = buildRepo();
    const base = stageAndCommit(vfs, { "base.txt": "base\n" }, "base", []);
    writeBranchHash(vfs, REPO_PATH, "main", base);
    const featureCommit = stageAndCommit(vfs, { "feature.txt": "feature\n" }, "feature change", [base]);
    writeBranchHash(vfs, REPO_PATH, "feature", featureCommit);

    const graph = buildCommitGraph(vfs, REPO_PATH);

    expect(graph.nodes.map((node) => node.hash).sort()).toEqual([base, featureCommit].sort());
    const featureNode = graph.nodes.find((node) => node.hash === featureCommit);
    const baseNode = graph.nodes.find((node) => node.hash === base);
    expect(featureNode?.branches).toEqual(["feature"]);
    expect(baseNode?.branches).toEqual(["main"]);
  });

  it("labels a commit pointed at by multiple branches with all of their names, sorted", () => {
    const vfs = buildRepo();
    const base = stageAndCommit(vfs, { "base.txt": "base\n" }, "base", []);
    writeBranchHash(vfs, REPO_PATH, "main", base);
    writeBranchHash(vfs, REPO_PATH, "feature", base);

    const graph = buildCommitGraph(vfs, REPO_PATH);

    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].branches).toEqual(["feature", "main"]);
  });

  it("includes a merge commit's two parents and keeps a deterministic newest-first order", () => {
    const vfs = buildRepo();
    const base = stageAndCommit(vfs, { "base.txt": "base\n" }, "base", []);
    const mainCommit = stageAndCommit(vfs, { "main-only.txt": "main\n" }, "main change", [base]);
    const featureCommit = stageAndCommit(vfs, { "feature-only.txt": "feature\n" }, "feature change", [base]);
    const mergeCommit = stageAndCommit(
      vfs,
      { "main-only.txt": "main\n", "feature-only.txt": "feature\n" },
      "merge feature into main",
      [mainCommit, featureCommit],
    );
    writeBranchHash(vfs, REPO_PATH, "main", mergeCommit);

    const graph = buildCommitGraph(vfs, REPO_PATH);

    const tiedParents = [mainCommit, featureCommit].sort((a, b) => a.localeCompare(b));
    expect(graph.nodes.map((node) => node.hash)).toEqual([mergeCommit, ...tiedParents, base]);
    expect(graph.nodes[0].parents.slice().sort()).toEqual([mainCommit, featureCommit].sort());
    expect(graph.nodes[0].branches).toEqual(["main"]);
  });
});
