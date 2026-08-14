import { describe, expect, it } from "vitest";

import {
  branchExists,
  listBranches,
  readBranchHash,
  readHeadBranch,
  readRemoteBranchHash,
  writeBranchHash,
  writeHeadBranch,
  writeRemoteBranchHash,
} from "./refs";
import { buildRepo, REPO_PATH } from "./testFixtures";

describe("refs", () => {
  it("HEAD points to 'main' right after init, which is unborn (no commits yet)", () => {
    const vfs = buildRepo();
    expect(readHeadBranch(vfs, REPO_PATH)).toBe("main");
    expect(readBranchHash(vfs, REPO_PATH, "main")).toBeUndefined();
    expect(branchExists(vfs, REPO_PATH, "main")).toBe(false);
  });

  it("writeBranchHash creates/updates the branch ref", () => {
    const vfs = buildRepo();
    writeBranchHash(vfs, REPO_PATH, "main", "abc123");
    expect(readBranchHash(vfs, REPO_PATH, "main")).toBe("abc123");
    expect(branchExists(vfs, REPO_PATH, "main")).toBe(true);
  });

  it("writeHeadBranch switches which branch HEAD follows", () => {
    const vfs = buildRepo();
    writeHeadBranch(vfs, REPO_PATH, "feature");
    expect(readHeadBranch(vfs, REPO_PATH)).toBe("feature");
  });

  it("listBranches returns branch names sorted alphabetically", () => {
    const vfs = buildRepo();
    writeBranchHash(vfs, REPO_PATH, "main", "h1");
    writeBranchHash(vfs, REPO_PATH, "feature", "h2");
    expect(listBranches(vfs, REPO_PATH)).toEqual(["feature", "main"]);
  });

  it("readRemoteBranchHash is undefined until a fetch/pull/push writes it", () => {
    const vfs = buildRepo();
    expect(readRemoteBranchHash(vfs, REPO_PATH, "origin", "main")).toBeUndefined();

    writeRemoteBranchHash(vfs, REPO_PATH, "origin", "main", "abc123");
    expect(readRemoteBranchHash(vfs, REPO_PATH, "origin", "main")).toBe("abc123");
  });
});
