import { describe, expect, it } from "vitest";

import type { VirtualFileSystem } from "../vfs";
import { createCommit } from "./commit";
import { upsertIndexEntry } from "./indexFile";
import { readObject, writeObject } from "./objectStore";
import { readBranchHash, readRemoteBranchHash, writeBranchHash } from "./refs";
import { initRepo } from "./repo";
import { fetchBranch, pushBranch } from "./remote";
import { buildRepo, REPO_PATH } from "./testFixtures";
import { buildTreeFromIndex, flattenTree } from "./tree";
import type { GitCommitObject, GitIndex } from "./types";

const REMOTE_PATH = "/home/study/remote";

/** ベースとなる親コミットのtreeに`files`を重ねた新規コミットを作成する(worktreeには触れない)。 */
function stageAndCommit(
  vfs: VirtualFileSystem,
  repoPath: string,
  files: Record<string, string>,
  message: string,
  parents: string[],
): string {
  let index: GitIndex =
    parents.length > 0
      ? flattenTree(vfs, repoPath, (readObject(vfs, repoPath, parents[0]) as GitCommitObject).tree)
      : [];
  for (const [path, content] of Object.entries(files)) {
    const blobHash = writeObject(vfs, repoPath, { type: "blob", content });
    index = upsertIndexEntry(index, { path, mode: "100644", blobHash });
  }
  const treeHash = buildTreeFromIndex(vfs, repoPath, index);
  return createCommit(vfs, repoPath, treeHash, message, parents).hash;
}

/** ローカルリポジトリ(`REPO_PATH`)に加え、`.git`のみを持つ疑似リモート(`REMOTE_PATH`)を用意する。 */
function buildRepoWithRemote(): VirtualFileSystem {
  const vfs = buildRepo();
  vfs.mkdir(REMOTE_PATH, { recursive: true });
  initRepo(vfs, REMOTE_PATH);
  return vfs;
}

describe("pushBranch", () => {
  it("copies reachable objects and creates the branch on the remote for a first push", () => {
    const vfs = buildRepoWithRemote();
    const hash = stageAndCommit(vfs, REPO_PATH, { "a.txt": "a\n" }, "first", []);
    writeBranchHash(vfs, REPO_PATH, "main", hash);

    const outcome = pushBranch(vfs, REPO_PATH, REMOTE_PATH, "main");

    expect(outcome).toEqual({ type: "ok", hash });
    expect(readBranchHash(vfs, REMOTE_PATH, "main")).toBe(hash);
    expect(readObject(vfs, REMOTE_PATH, hash)).toEqual(readObject(vfs, REPO_PATH, hash));
  });

  it("fast-forwards the remote branch when local history has moved ahead", () => {
    const vfs = buildRepoWithRemote();
    const base = stageAndCommit(vfs, REPO_PATH, { "a.txt": "a\n" }, "first", []);
    writeBranchHash(vfs, REPO_PATH, "main", base);
    pushBranch(vfs, REPO_PATH, REMOTE_PATH, "main");

    const ahead = stageAndCommit(vfs, REPO_PATH, { "b.txt": "b\n" }, "second", [base]);
    writeBranchHash(vfs, REPO_PATH, "main", ahead);

    const outcome = pushBranch(vfs, REPO_PATH, REMOTE_PATH, "main");

    expect(outcome).toEqual({ type: "ok", hash: ahead });
    expect(readBranchHash(vfs, REMOTE_PATH, "main")).toBe(ahead);
  });

  it("reports up-to-date when the remote already matches the local branch", () => {
    const vfs = buildRepoWithRemote();
    const hash = stageAndCommit(vfs, REPO_PATH, { "a.txt": "a\n" }, "first", []);
    writeBranchHash(vfs, REPO_PATH, "main", hash);
    pushBranch(vfs, REPO_PATH, REMOTE_PATH, "main");

    const outcome = pushBranch(vfs, REPO_PATH, REMOTE_PATH, "main");
    expect(outcome).toEqual({ type: "up-to-date" });
  });

  it("rejects a non-fast-forward push and leaves the remote branch untouched", () => {
    const vfs = buildRepoWithRemote();
    const base = stageAndCommit(vfs, REPO_PATH, { "a.txt": "a\n" }, "first", []);
    writeBranchHash(vfs, REPO_PATH, "main", base);
    pushBranch(vfs, REPO_PATH, REMOTE_PATH, "main");

    // Someone else pushed directly to the remote, diverging its history from local.
    const remoteOnly = stageAndCommit(vfs, REMOTE_PATH, { "remote.txt": "remote\n" }, "remote change", [base]);
    writeBranchHash(vfs, REMOTE_PATH, "main", remoteOnly);

    // Local also moves on independently, without ever seeing the remote's new commit.
    const localOnly = stageAndCommit(vfs, REPO_PATH, { "local.txt": "local\n" }, "local change", [base]);
    writeBranchHash(vfs, REPO_PATH, "main", localOnly);

    const outcome = pushBranch(vfs, REPO_PATH, REMOTE_PATH, "main");

    expect(outcome).toEqual({ type: "rejected" });
    expect(readBranchHash(vfs, REMOTE_PATH, "main")).toBe(remoteOnly);
  });

  it("throws when the local branch has no commits yet", () => {
    const vfs = buildRepoWithRemote();
    expect(() => pushBranch(vfs, REPO_PATH, REMOTE_PATH, "main")).toThrow(/src refspec/);
  });
});

describe("fetchBranch", () => {
  it("copies remote objects to the local store and updates the remote-tracking ref", () => {
    const vfs = buildRepoWithRemote();
    const hash = stageAndCommit(vfs, REMOTE_PATH, { "a.txt": "a\n" }, "first", []);
    writeBranchHash(vfs, REMOTE_PATH, "main", hash);

    const fetched = fetchBranch(vfs, REPO_PATH, REMOTE_PATH, "origin", "main");

    expect(fetched).toBe(hash);
    expect(readObject(vfs, REPO_PATH, hash)).toEqual(readObject(vfs, REMOTE_PATH, hash));
    expect(readRemoteBranchHash(vfs, REPO_PATH, "origin", "main")).toBe(hash);
  });

  it("returns undefined when the remote does not have the branch", () => {
    const vfs = buildRepoWithRemote();
    expect(fetchBranch(vfs, REPO_PATH, REMOTE_PATH, "origin", "main")).toBeUndefined();
  });
});
