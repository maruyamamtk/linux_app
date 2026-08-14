import { describe, expect, it } from "vitest";

import { getRemoteUrl, readConfig, setRemoteUrl } from "./config";
import { buildRepo, REPO_PATH } from "./testFixtures";

describe("git config (remotes)", () => {
  it("returns an empty remotes map when .git/config does not exist yet", () => {
    const vfs = buildRepo();
    expect(readConfig(vfs, REPO_PATH)).toEqual({ remotes: {} });
    expect(getRemoteUrl(vfs, REPO_PATH, "origin")).toBeUndefined();
  });

  it("persists a remote url set via setRemoteUrl", () => {
    const vfs = buildRepo();
    setRemoteUrl(vfs, REPO_PATH, "origin", "/home/study/remote");
    expect(getRemoteUrl(vfs, REPO_PATH, "origin")).toBe("/home/study/remote");
  });

  it("preserves existing remotes when adding another one", () => {
    const vfs = buildRepo();
    setRemoteUrl(vfs, REPO_PATH, "origin", "/home/study/remote");
    setRemoteUrl(vfs, REPO_PATH, "upstream", "/home/study/upstream");

    expect(readConfig(vfs, REPO_PATH).remotes).toEqual({
      origin: "/home/study/remote",
      upstream: "/home/study/upstream",
    });
  });

  it("overwrites an existing remote of the same name", () => {
    const vfs = buildRepo();
    setRemoteUrl(vfs, REPO_PATH, "origin", "/home/study/old-remote");
    setRemoteUrl(vfs, REPO_PATH, "origin", "/home/study/new-remote");

    expect(getRemoteUrl(vfs, REPO_PATH, "origin")).toBe("/home/study/new-remote");
  });
});
