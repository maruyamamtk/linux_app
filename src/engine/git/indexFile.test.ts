import { describe, expect, it } from "vitest";

import { readIndex, removeIndexEntry, upsertIndexEntry, writeIndex } from "./indexFile";
import { buildRepo, REPO_PATH } from "./testFixtures";

describe("index file", () => {
  it("starts empty right after init", () => {
    const vfs = buildRepo();
    expect(readIndex(vfs, REPO_PATH)).toEqual([]);
  });

  it("round-trips entries through write/read, sorted by path", () => {
    const vfs = buildRepo();
    writeIndex(vfs, REPO_PATH, [
      { path: "b.txt", mode: "100644", blobHash: "hb" },
      { path: "a.txt", mode: "100644", blobHash: "ha" },
    ]);
    expect(readIndex(vfs, REPO_PATH)).toEqual([
      { path: "a.txt", mode: "100644", blobHash: "ha" },
      { path: "b.txt", mode: "100644", blobHash: "hb" },
    ]);
  });

  it("upsertIndexEntry overwrites an existing entry for the same path", () => {
    let index = upsertIndexEntry([], { path: "a.txt", mode: "100644", blobHash: "h1" });
    index = upsertIndexEntry(index, { path: "a.txt", mode: "100644", blobHash: "h2" });
    expect(index).toEqual([{ path: "a.txt", mode: "100644", blobHash: "h2" }]);
  });

  it("removeIndexEntry drops the entry for the given path", () => {
    const index = upsertIndexEntry([], { path: "a.txt", mode: "100644", blobHash: "h1" });
    expect(removeIndexEntry(index, "a.txt")).toEqual([]);
  });
});
