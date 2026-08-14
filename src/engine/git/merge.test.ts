import { describe, expect, it } from "vitest";

import { joinPath } from "../vfs";
import { createCommit } from "./commit";
import { upsertIndexEntry } from "./indexFile";
import { performMerge } from "./merge";
import { readObject, writeObject } from "./objectStore";
import { readBranchHash, writeBranchHash } from "./refs";
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

describe("performMerge", () => {
  it("reports up-to-date when the other branch is already merged", () => {
    const vfs = buildRepo();
    const base = stageAndCommit(vfs, { "base.txt": "base\n" }, "base", []);
    const ahead = stageAndCommit(vfs, { "extra.txt": "extra\n" }, "extra", [base]);

    const outcome = performMerge(vfs, REPO_PATH, "main", ahead, base, "merge base into ahead");
    expect(outcome).toEqual({ type: "up-to-date" });
  });

  it("fast-forwards when HEAD is an ancestor of the other branch", () => {
    const vfs = buildRepo();
    const base = stageAndCommit(vfs, { "base.txt": "base\n" }, "base", []);
    writeBranchHash(vfs, REPO_PATH, "main", base);
    const featureCommit = stageAndCommit(vfs, { "feature.txt": "feature\n" }, "feature change", [base]);
    writeBranchHash(vfs, REPO_PATH, "feature", featureCommit);

    const outcome = performMerge(vfs, REPO_PATH, "main", base, featureCommit, "merge feature into main");

    expect(outcome).toEqual({ type: "fast-forward", commitHash: featureCommit });
    expect(readBranchHash(vfs, REPO_PATH, "main")).toBe(featureCommit);
    expect(vfs.readFile(joinPath(REPO_PATH, "feature.txt"))).toBe("feature\n");
    expect(vfs.readFile(joinPath(REPO_PATH, "base.txt"))).toBe("base\n");
  });

  it("creates a merge commit for non-conflicting diverged changes", () => {
    const vfs = buildRepo();
    const base = stageAndCommit(vfs, { "base.txt": "base\n" }, "base", []);
    const mainCommit = stageAndCommit(vfs, { "main-only.txt": "main\n" }, "main change", [base]);
    const featureCommit = stageAndCommit(vfs, { "feature-only.txt": "feature\n" }, "feature change", [base]);
    writeBranchHash(vfs, REPO_PATH, "main", mainCommit);

    const outcome = performMerge(vfs, REPO_PATH, "main", mainCommit, featureCommit, "merge feature into main");

    expect(outcome.type).toBe("merged");
    if (outcome.type !== "merged") throw new Error("expected a merge commit");

    const commit = readObject(vfs, REPO_PATH, outcome.commitHash) as GitCommitObject;
    expect(commit.parents).toEqual([mainCommit, featureCommit]);
    expect(readBranchHash(vfs, REPO_PATH, "main")).toBe(outcome.commitHash);

    const paths = flattenTree(vfs, REPO_PATH, commit.tree)
      .map((entry) => entry.path)
      .sort();
    expect(paths).toEqual(["base.txt", "feature-only.txt", "main-only.txt"]);
    expect(vfs.readFile(joinPath(REPO_PATH, "feature-only.txt"))).toBe("feature\n");
    expect(vfs.readFile(joinPath(REPO_PATH, "main-only.txt"))).toBe("main\n");
  });

  it("reports a conflict and leaves refs untouched when both branches edit the same file differently", () => {
    const vfs = buildRepo();
    const base = stageAndCommit(vfs, { "shared.txt": "base\n" }, "base", []);
    const mainCommit = stageAndCommit(vfs, { "shared.txt": "main version\n" }, "main edits shared", [base]);
    const featureCommit = stageAndCommit(
      vfs,
      { "shared.txt": "feature version\n" },
      "feature edits shared",
      [base],
    );
    writeBranchHash(vfs, REPO_PATH, "main", mainCommit);

    const outcome = performMerge(vfs, REPO_PATH, "main", mainCommit, featureCommit, "merge feature into main");

    expect(outcome).toEqual({ type: "conflict", paths: ["shared.txt"] });
    expect(readBranchHash(vfs, REPO_PATH, "main")).toBe(mainCommit);
  });
});
