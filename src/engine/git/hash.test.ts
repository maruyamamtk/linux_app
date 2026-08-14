import { describe, expect, it } from "vitest";

import { hashObject } from "./hash";
import type { GitBlobObject, GitTreeObject } from "./types";

describe("hashObject", () => {
  it("returns a 40-character hex string", () => {
    const hash = hashObject({ type: "blob", content: "hello\n" });
    expect(hash).toMatch(/^[0-9a-f]{40}$/);
  });

  it("is deterministic for the same content", () => {
    const a: GitBlobObject = { type: "blob", content: "hello\n" };
    const b: GitBlobObject = { type: "blob", content: "hello\n" };
    expect(hashObject(a)).toBe(hashObject(b));
  });

  it("differs when content differs", () => {
    const a: GitBlobObject = { type: "blob", content: "hello\n" };
    const b: GitBlobObject = { type: "blob", content: "world\n" };
    expect(hashObject(a)).not.toBe(hashObject(b));
  });

  it("is independent of tree entry order (sorted before hashing)", () => {
    const treeA: GitTreeObject = {
      type: "tree",
      entries: [
        { name: "a.txt", mode: "100644", type: "blob", hash: "x" },
        { name: "b.txt", mode: "100644", type: "blob", hash: "y" },
      ],
    };
    const treeB: GitTreeObject = {
      type: "tree",
      entries: [
        { name: "b.txt", mode: "100644", type: "blob", hash: "y" },
        { name: "a.txt", mode: "100644", type: "blob", hash: "x" },
      ],
    };
    expect(hashObject(treeA)).toBe(hashObject(treeB));
  });

  it("differs for commits with different messages", () => {
    const base = {
      type: "commit" as const,
      tree: "tree-hash",
      parents: [],
      author: "study <study@localhost>",
      sequence: 0,
    };
    expect(hashObject({ ...base, message: "first" })).not.toBe(hashObject({ ...base, message: "second" }));
  });
});
