import { describe, expect, it } from "vitest";

import { GitError } from "./errors";
import { objectExists, readObject, writeObject } from "./objectStore";
import { buildRepo, REPO_PATH } from "./testFixtures";

describe("writeObject / readObject", () => {
  it("writes an object and reads it back by its computed hash", () => {
    const vfs = buildRepo();
    const hash = writeObject(vfs, REPO_PATH, { type: "blob", content: "hello\n" });
    expect(objectExists(vfs, REPO_PATH, hash)).toBe(true);
    expect(readObject(vfs, REPO_PATH, hash)).toEqual({ type: "blob", content: "hello\n" });
  });

  it("does not rewrite an object that already exists (content-addressed)", () => {
    const vfs = buildRepo();
    const hashA = writeObject(vfs, REPO_PATH, { type: "blob", content: "same\n" });
    const hashB = writeObject(vfs, REPO_PATH, { type: "blob", content: "same\n" });
    expect(hashA).toBe(hashB);
  });

  it("throws a GitError for an unknown hash", () => {
    const vfs = buildRepo();
    expect(() => readObject(vfs, REPO_PATH, "0".repeat(40))).toThrow(GitError);
  });
});
