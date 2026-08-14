import { describe, expect, it } from "vitest";

import { joinPath } from "../vfs";
import { writeObject } from "./objectStore";
import { buildRepo, REPO_PATH } from "./testFixtures";
import { buildTreeFromIndex, flattenTree, listWorktreeFiles, materializeTree } from "./tree";
import type { GitIndex } from "./types";

function writeBlob(vfs: ReturnType<typeof buildRepo>, content: string): string {
  return writeObject(vfs, REPO_PATH, { type: "blob", content });
}

describe("buildTreeFromIndex / flattenTree", () => {
  it("builds a nested tree from flat index entries and flattens it back to the same entries", () => {
    const vfs = buildRepo();
    const rootHash = writeBlob(vfs, "root\n");
    const nestedHash = writeBlob(vfs, "nested\n");
    const index: GitIndex = [
      { path: "readme.txt", mode: "100644", blobHash: rootHash },
      { path: "src/main.txt", mode: "100644", blobHash: nestedHash },
    ];

    const treeHash = buildTreeFromIndex(vfs, REPO_PATH, index);
    const flattened = flattenTree(vfs, REPO_PATH, treeHash);

    expect([...flattened].sort((a, b) => a.path.localeCompare(b.path))).toEqual(
      [...index].sort((a, b) => a.path.localeCompare(b.path)),
    );
  });

  it("produces the same tree hash for the same content regardless of index order", () => {
    const vfs = buildRepo();
    const hashA = writeBlob(vfs, "a\n");
    const hashB = writeBlob(vfs, "b\n");
    const treeA = buildTreeFromIndex(vfs, REPO_PATH, [
      { path: "a.txt", mode: "100644", blobHash: hashA },
      { path: "b.txt", mode: "100644", blobHash: hashB },
    ]);
    const treeB = buildTreeFromIndex(vfs, REPO_PATH, [
      { path: "b.txt", mode: "100644", blobHash: hashB },
      { path: "a.txt", mode: "100644", blobHash: hashA },
    ]);
    expect(treeA).toBe(treeB);
  });

  it("flattenTree returns an empty array for an undefined tree hash (unborn branch)", () => {
    const vfs = buildRepo();
    expect(flattenTree(vfs, REPO_PATH, undefined)).toEqual([]);
  });
});

describe("listWorktreeFiles", () => {
  it("lists worktree files recursively, excluding .git", () => {
    const vfs = buildRepo();
    vfs.writeFile(joinPath(REPO_PATH, "a.txt"), "a\n");
    vfs.mkdir(joinPath(REPO_PATH, "docs"));
    vfs.writeFile(joinPath(REPO_PATH, "docs/b.txt"), "b\n");

    expect(listWorktreeFiles(vfs, REPO_PATH).sort()).toEqual(["a.txt", "docs/b.txt"]);
  });
});

describe("materializeTree", () => {
  it("recreates worktree files to match the target tree and removes files not present in it", () => {
    const vfs = buildRepo();
    vfs.writeFile(joinPath(REPO_PATH, "stale.txt"), "stale\n");

    const keptHash = writeBlob(vfs, "kept\n");
    const nestedHash = writeBlob(vfs, "nested\n");
    const treeHash = buildTreeFromIndex(vfs, REPO_PATH, [
      { path: "kept.txt", mode: "100644", blobHash: keptHash },
      { path: "dir/nested.txt", mode: "100644", blobHash: nestedHash },
    ]);

    materializeTree(vfs, REPO_PATH, treeHash);

    expect(vfs.exists(joinPath(REPO_PATH, "stale.txt"))).toBe(false);
    expect(vfs.readFile(joinPath(REPO_PATH, "kept.txt"))).toBe("kept\n");
    expect(vfs.readFile(joinPath(REPO_PATH, "dir/nested.txt"))).toBe("nested\n");
    // node.modeは純粋な9bit権限値であるべき(実Gitのtree entry modeをそのまま8進数parseIntすると
    // 上位のファイル種別bitまで含んでしまう回帰を防ぐ)。
    expect(vfs.stat(joinPath(REPO_PATH, "kept.txt")).mode).toBe(0o644);
  });

  it("materializes an executable ('100755') entry with mode 0o755", () => {
    const vfs = buildRepo();
    const scriptHash = writeBlob(vfs, "#!/bin/sh\necho hi\n");
    const treeHash = buildTreeFromIndex(vfs, REPO_PATH, [
      { path: "run.sh", mode: "100755", blobHash: scriptHash },
    ]);

    materializeTree(vfs, REPO_PATH, treeHash);

    expect(vfs.stat(joinPath(REPO_PATH, "run.sh")).mode).toBe(0o755);
  });

  it("removes directories that become empty after materialization", () => {
    const vfs = buildRepo();
    vfs.mkdir(joinPath(REPO_PATH, "docs"));
    vfs.writeFile(joinPath(REPO_PATH, "docs/old.txt"), "old\n");

    materializeTree(vfs, REPO_PATH, undefined);

    expect(vfs.exists(joinPath(REPO_PATH, "docs"))).toBe(false);
  });
});
