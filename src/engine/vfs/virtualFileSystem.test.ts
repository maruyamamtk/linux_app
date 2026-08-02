import { describe, expect, it } from "vitest";

import type { VfsErrorCode } from "./errors";
import { VfsError } from "./errors";
import { normalizePath } from "./path";
import { createDirectory, createFile } from "./tree";
import type { VfsSnapshot, VfsUser } from "./types";
import { VirtualFileSystem } from "./virtualFileSystem";

const STUDY_USER: VfsUser = { name: "study", groups: ["study"] };
const ROOT_USER: VfsUser = { name: "root", groups: ["root"], isRoot: true };

function buildSnapshot(): VfsSnapshot {
  const root = createDirectory(
    "",
    {
      home: createDirectory(
        "home",
        {
          study: createDirectory(
            "study",
            {
              "file1.txt": createFile("file1.txt", "hello", {
                owner: "study",
                group: "study",
                mode: 0o644,
              }),
            },
            { owner: "study", group: "study", mode: 0o755 },
          ),
        },
        { owner: "root", group: "root", mode: 0o755 },
      ),
      etc: createDirectory(
        "etc",
        {
          passwd: createFile("passwd", "root:x:0:0", {
            owner: "root",
            group: "root",
            mode: 0o644,
          }),
        },
        { owner: "root", group: "root", mode: 0o755 },
      ),
      root: createDirectory(
        "root",
        {
          "secret.txt": createFile("secret.txt", "top-secret", {
            owner: "root",
            group: "root",
            mode: 0o600,
          }),
        },
        { owner: "root", group: "root", mode: 0o700 },
      ),
      shared: createDirectory(
        "shared",
        {
          data: createDirectory(
            "data",
            {
              "info.txt": createFile("info.txt", "info", {
                owner: "root",
                group: "root",
                mode: 0o644,
              }),
            },
            { owner: "root", group: "root", mode: 0o755 },
          ),
        },
        { owner: "root", group: "root", mode: 0o755 },
      ),
    },
    { owner: "root", group: "root", mode: 0o755 },
  );

  return { id: "test-snapshot", root };
}

function createVfs(user: VfsUser = STUDY_USER): VirtualFileSystem {
  return new VirtualFileSystem(buildSnapshot(), user);
}

function expectVfsError(fn: () => void, code: VfsErrorCode): void {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught, `expected a VfsError(${code}) to be thrown`).toBeInstanceOf(VfsError);
  expect((caught as VfsError).code).toBe(code);
}

describe("normalizePath", () => {
  it("resolves '.' and '..' segments", () => {
    expect(normalizePath("/home/../etc")).toBe("/etc");
    expect(normalizePath("/home/./study")).toBe("/home/study");
  });

  it("does not escape above the root", () => {
    expect(normalizePath("/../../etc")).toBe("/etc");
  });
});

describe("resolve / permissions", () => {
  it("reads a nested file via stat()", () => {
    const vfs = createVfs();
    const stat = vfs.stat("/home/study/file1.txt");
    expect(stat.type).toBe("file");
    expect(stat.owner).toBe("study");
  });

  it("throws EACCES before ENOENT when a parent directory lacks execute permission", () => {
    const vfs = createVfs(STUDY_USER);
    // /root is mode 0700 owned by root; study cannot even check whether
    // "does-not-exist.txt" exists because traversal is blocked first.
    expectVfsError(() => vfs.stat("/root/does-not-exist.txt"), "EACCES");
  });
});

describe("mkdir", () => {
  it("creates a directory when the parent is writable", () => {
    const vfs = createVfs();
    vfs.mkdir("/home/study/newdir");
    expect(vfs.stat("/home/study/newdir").type).toBe("directory");
  });

  it("throws EEXIST before EACCES when the name already exists in an unwritable parent", () => {
    const vfs = createVfs(STUDY_USER);
    // /etc is not writable by "study", and "passwd" already exists there.
    expectVfsError(() => vfs.mkdir("/etc/passwd"), "EEXIST");
  });

  it("throws EACCES when the parent is not writable and the name is free", () => {
    const vfs = createVfs(STUDY_USER);
    expectVfsError(() => vfs.mkdir("/etc/newdir"), "EACCES");
  });

  it("creates intermediate directories with recursive: true", () => {
    const vfs = createVfs();
    vfs.mkdir("/home/study/a/b/c", { recursive: true });
    expect(vfs.stat("/home/study/a/b/c").type).toBe("directory");
  });
});

describe("readFile / writeFile", () => {
  it("round-trips file content", () => {
    const vfs = createVfs();
    vfs.writeFile("/home/study/new.txt", "content");
    expect(vfs.readFile("/home/study/new.txt")).toBe("content");
  });

  it("throws EACCES when writing to a file without write permission", () => {
    const vfs = createVfs(STUDY_USER);
    expectVfsError(() => vfs.writeFile("/etc/passwd", "hacked"), "EACCES");
  });
});

describe("/dev/null special behavior", () => {
  it("discards anything written to it", () => {
    const vfs = createVfs();
    vfs.writeFile("/dev/null", "some content");
    expect(vfs.readFile("/dev/null")).toBe("");
  });

  it("discards appends too", () => {
    const vfs = createVfs();
    vfs.appendFile("/dev/null", "some content");
    expect(vfs.readFile("/dev/null")).toBe("");
  });

  it("always reads as empty, even without a seeded node at that path", () => {
    const vfs = createVfs();
    expect(vfs.exists("/dev/null")).toBe(false);
    expect(vfs.readFile("/dev/null")).toBe("");
  });
});

describe("move", () => {
  it("renames a file without changing its owner", () => {
    const vfs = createVfs(ROOT_USER);
    vfs.move("/shared/data/info.txt", "/shared/data/renamed.txt");
    const stat = vfs.stat("/shared/data/renamed.txt");
    expect(stat.owner).toBe("root");
    expect(vfs.readFile("/shared/data/renamed.txt")).toBe("info");
  });

  it("throws EINVAL when moving a directory into itself", () => {
    const vfs = createVfs(ROOT_USER);
    expectVfsError(() => vfs.move("/shared", "/shared/data"), "EINVAL");
  });

  it("throws EEXIST before EACCES when the destination name already exists in an unwritable parent", () => {
    const vfs = createVfs(STUDY_USER);
    expectVfsError(() => vfs.move("/home/study/file1.txt", "/etc/passwd"), "EEXIST");
  });
});

describe("copy", () => {
  it("throws EISDIR for a directory source without recursive", () => {
    const vfs = createVfs(ROOT_USER);
    expectVfsError(() => vfs.copy("/shared", "/home/study/shared-copy"), "EISDIR");
  });

  it("throws EINVAL when copying a directory into itself", () => {
    const vfs = createVfs(ROOT_USER);
    expectVfsError(() => vfs.copy("/shared", "/shared/data", { recursive: true }), "EINVAL");
  });

  it("throws EEXIST before EACCES when the destination name already exists in an unwritable parent", () => {
    const vfs = createVfs(STUDY_USER);
    expectVfsError(
      () => vfs.copy("/home/study/file1.txt", "/etc/passwd", { recursive: true }),
      "EEXIST",
    );
  });

  it("reassigns owner/group of nested children when copying a directory recursively", () => {
    const vfs = createVfs(STUDY_USER);
    vfs.copy("/shared", "/home/study/shared-copy", { recursive: true });

    expect(vfs.stat("/home/study/shared-copy").owner).toBe("study");
    expect(vfs.stat("/home/study/shared-copy/data").owner).toBe("study");
    const nestedFile = vfs.stat("/home/study/shared-copy/data/info.txt");
    expect(nestedFile.owner).toBe("study");
    expect(nestedFile.group).toBe("study");
    expect(vfs.readFile("/home/study/shared-copy/data/info.txt")).toBe("info");

    // the original tree must be untouched
    expect(vfs.stat("/shared/data/info.txt").owner).toBe("root");
  });
});

describe("chmod / chown", () => {
  it("allows the owner to chmod their own file", () => {
    const vfs = createVfs(STUDY_USER);
    vfs.chmod("/home/study/file1.txt", 0o600);
    expect(vfs.stat("/home/study/file1.txt").mode).toBe(0o600);
  });

  it("throws EACCES when a non-owner, non-root user tries to chmod", () => {
    const vfs = createVfs(STUDY_USER);
    expectVfsError(() => vfs.chmod("/etc/passwd", 0o666), "EACCES");
  });

  it("throws EACCES when a non-root user tries to chown", () => {
    const vfs = createVfs(STUDY_USER);
    expectVfsError(() => vfs.chown("/home/study/file1.txt", "root"), "EACCES");
  });

  it("allows root to chown any file", () => {
    const vfs = createVfs(ROOT_USER);
    vfs.chown("/home/study/file1.txt", "root", "root");
    const stat = vfs.stat("/home/study/file1.txt");
    expect(stat.owner).toBe("root");
    expect(stat.group).toBe("root");
  });
});

describe("snapshot diff / reset", () => {
  it("reports no diff for an untouched snapshot", () => {
    const vfs = createVfs();
    expect(vfs.diff()).toEqual([]);
  });

  it("tracks added files and clears after reset()", () => {
    const vfs = createVfs();
    vfs.writeFile("/home/study/new.txt", "content");

    const diff = vfs.diff();
    expect(diff).toContainEqual({
      path: "/home/study/new.txt",
      change: "added",
      nodeType: "file",
    });

    vfs.reset();
    expect(vfs.exists("/home/study/new.txt")).toBe(false);
    expect(vfs.diff()).toEqual([]);
  });
});
