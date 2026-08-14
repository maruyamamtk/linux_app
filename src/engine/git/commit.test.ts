import { describe, expect, it } from "vitest";

import { authorFromUser, collectAncestors, createCommit, findMergeBase, isAncestor, nextSequence } from "./commit";
import { buildRepo, REPO_PATH } from "./testFixtures";

describe("authorFromUser", () => {
  it("derives 'name <name@localhost>' from the VFS current user", () => {
    const vfs = buildRepo();
    expect(authorFromUser(vfs)).toBe("study <study@localhost>");
  });
});

describe("createCommit / nextSequence", () => {
  it("initial commit has sequence 0 and no parents", () => {
    const vfs = buildRepo();
    const { commit } = createCommit(vfs, REPO_PATH, "tree-hash", "first", []);
    expect(commit.sequence).toBe(0);
    expect(commit.parents).toEqual([]);
  });

  it("a child commit's sequence is the max parent sequence + 1", () => {
    const vfs = buildRepo();
    const first = createCommit(vfs, REPO_PATH, "tree-hash-1", "first", []);
    const second = createCommit(vfs, REPO_PATH, "tree-hash-2", "second", [first.hash]);
    expect(second.commit.sequence).toBe(1);
    expect(nextSequence(vfs, REPO_PATH, [first.hash])).toBe(1);
  });
});

describe("collectAncestors / isAncestor / findMergeBase", () => {
  it("collects the initial commit and itself for a single-commit history", () => {
    const vfs = buildRepo();
    const first = createCommit(vfs, REPO_PATH, "t1", "first", []);
    expect(collectAncestors(vfs, REPO_PATH, first.hash)).toEqual(new Set([first.hash]));
  });

  it("isAncestor is true for an earlier commit on the same line of history", () => {
    const vfs = buildRepo();
    const first = createCommit(vfs, REPO_PATH, "t1", "first", []);
    const second = createCommit(vfs, REPO_PATH, "t2", "second", [first.hash]);
    expect(isAncestor(vfs, REPO_PATH, first.hash, second.hash)).toBe(true);
    expect(isAncestor(vfs, REPO_PATH, second.hash, first.hash)).toBe(false);
  });

  it("findMergeBase finds the common ancestor of two diverged branches", () => {
    const vfs = buildRepo();
    const base = createCommit(vfs, REPO_PATH, "t0", "base", []);
    const featureA = createCommit(vfs, REPO_PATH, "ta", "feature A", [base.hash]);
    const featureB = createCommit(vfs, REPO_PATH, "tb", "feature B", [base.hash]);
    expect(findMergeBase(vfs, REPO_PATH, featureA.hash, featureB.hash)).toBe(base.hash);
  });

  it("findMergeBase returns undefined for histories with no common ancestor", () => {
    const vfs = buildRepo();
    const a = createCommit(vfs, REPO_PATH, "ta", "a", []);
    const b = createCommit(vfs, REPO_PATH, "tb", "b", []);
    expect(findMergeBase(vfs, REPO_PATH, a.hash, b.hash)).toBeUndefined();
  });
});
