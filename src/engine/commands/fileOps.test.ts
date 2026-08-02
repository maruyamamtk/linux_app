import { describe, expect, it } from "vitest";

import {
  cdCommand,
  cpCommand,
  lnCommand,
  lsCommand,
  mkdirCommand,
  mvCommand,
  pwdCommand,
  rmCommand,
  rmdirCommand,
  touchCommand,
} from "./fileOps";
import { ROOT_USER, buildContext } from "./testFixtures";

describe("pwd", () => {
  it("prints the current working directory", () => {
    const context = buildContext(undefined, "/home/study/docs");
    expect(pwdCommand([], context)).toEqual({ stdout: "/home/study/docs\n", stderr: "", exitCode: 0 });
  });
});

describe("cd", () => {
  it("changes cwd to an existing directory", () => {
    const context = buildContext();
    const result = cdCommand(["docs"], context);
    expect(result.exitCode).toBe(0);
    expect(context.cwd).toBe("/home/study/docs");
  });

  it("defaults to $HOME when no argument is given", () => {
    const context = buildContext(undefined, "/home/study/docs");
    cdCommand([], context);
    expect(context.cwd).toBe("/home/study");
  });

  it("fails with an error for a missing directory", () => {
    const context = buildContext();
    const result = cdCommand(["nope"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("No such file or directory");
    expect(context.cwd).toBe("/home/study");
  });

  it("fails when the target is a file", () => {
    const context = buildContext();
    const result = cdCommand(["file1.txt"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Not a directory");
  });
});

describe("ls", () => {
  it("lists visible entries sorted by name, excluding dotfiles", () => {
    const context = buildContext();
    const result = lsCommand([], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("docs  empty  file1.txt\n");
  });

  it("includes dotfiles with -a", () => {
    const context = buildContext();
    const result = lsCommand(["-a"], context);
    expect(result.stdout).toContain(".hidden");
  });

  it("shows permissions/owner/size with -l", () => {
    const context = buildContext();
    const result = lsCommand(["-l", "file1.txt"], context);
    expect(result.stdout).toMatch(/^-rw-r--r-- study study\s+6 file1\.txt\n$/);
  });

  it("reports an error for a missing path", () => {
    const context = buildContext();
    const result = lsCommand(["nope"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("cannot access");
  });
});

describe("mkdir", () => {
  it("creates a new directory", () => {
    const context = buildContext();
    const result = mkdirCommand(["newdir"], context);
    expect(result.exitCode).toBe(0);
    expect(context.vfs.stat("/home/study/newdir").type).toBe("directory");
  });

  it("fails without -p when the parent is missing", () => {
    const context = buildContext();
    const result = mkdirCommand(["a/b/c"], context);
    expect(result.exitCode).toBe(1);
  });

  it("creates intermediate directories with -p", () => {
    const context = buildContext();
    const result = mkdirCommand(["-p", "a/b/c"], context);
    expect(result.exitCode).toBe(0);
    expect(context.vfs.stat("/home/study/a/b/c").type).toBe("directory");
  });
});

describe("touch", () => {
  it("creates a new empty file", () => {
    const context = buildContext();
    const result = touchCommand(["new.txt"], context);
    expect(result.exitCode).toBe(0);
    expect(context.vfs.readFile("/home/study/new.txt")).toBe("");
  });

  it("leaves the content of an existing file unchanged", () => {
    const context = buildContext();
    const result = touchCommand(["file1.txt"], context);
    expect(result.exitCode).toBe(0);
    expect(context.vfs.readFile("/home/study/file1.txt")).toBe("hello\n");
  });
});

describe("rm", () => {
  it("removes a file", () => {
    const context = buildContext();
    const result = rmCommand(["file1.txt"], context);
    expect(result.exitCode).toBe(0);
    expect(context.vfs.exists("/home/study/file1.txt")).toBe(false);
  });

  it("refuses to remove a directory without -r", () => {
    const context = buildContext();
    const result = rmCommand(["docs"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Is a directory");
    expect(context.vfs.exists("/home/study/docs")).toBe(true);
  });

  it("removes a directory recursively with -r", () => {
    const context = buildContext();
    const result = rmCommand(["-r", "docs"], context);
    expect(result.exitCode).toBe(0);
    expect(context.vfs.exists("/home/study/docs")).toBe(false);
  });

  it("ignores a missing target with -f", () => {
    const context = buildContext();
    const result = rmCommand(["-f", "nope.txt"], context);
    expect(result).toEqual({ stdout: "", stderr: "", exitCode: 0 });
  });
});

describe("rmdir", () => {
  it("removes an empty directory", () => {
    const context = buildContext();
    const result = rmdirCommand(["empty"], context);
    expect(result.exitCode).toBe(0);
    expect(context.vfs.exists("/home/study/empty")).toBe(false);
  });

  it("fails for a non-empty directory", () => {
    const context = buildContext();
    const result = rmdirCommand(["docs"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Directory not empty");
  });
});

describe("cp", () => {
  it("copies a file", () => {
    const context = buildContext();
    const result = cpCommand(["file1.txt", "copy.txt"], context);
    expect(result.exitCode).toBe(0);
    expect(context.vfs.readFile("/home/study/copy.txt")).toBe("hello\n");
    expect(context.vfs.exists("/home/study/file1.txt")).toBe(true);
  });

  it("refuses to copy a directory without -r", () => {
    const context = buildContext();
    const result = cpCommand(["docs", "docs-copy"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("-r not specified");
  });

  it("copies a directory recursively with -r", () => {
    const context = buildContext();
    const result = cpCommand(["-r", "docs", "docs-copy"], context);
    expect(result.exitCode).toBe(0);
    expect(context.vfs.readFile("/home/study/docs-copy/a.txt")).toBe("A\n");
  });
});

describe("mv", () => {
  it("moves/renames a file", () => {
    const context = buildContext();
    const result = mvCommand(["file1.txt", "renamed.txt"], context);
    expect(result.exitCode).toBe(0);
    expect(context.vfs.exists("/home/study/file1.txt")).toBe(false);
    expect(context.vfs.readFile("/home/study/renamed.txt")).toBe("hello\n");
  });
});

describe("ln", () => {
  it("creates a new path with the same content as the source", () => {
    const context = buildContext();
    const result = lnCommand(["file1.txt", "link.txt"], context);
    expect(result.exitCode).toBe(0);
    expect(context.vfs.readFile("/home/study/link.txt")).toBe("hello\n");
  });

  it("refuses a hard link to a directory without -s", () => {
    const context = buildContext();
    const result = lnCommand(["docs", "docs-link"], context);
    expect(result.exitCode).toBe(1);
  });

  it("allows a symbolic link to a directory with -s", () => {
    const context = buildContext(ROOT_USER, "/home/study");
    const result = lnCommand(["-s", "docs", "docs-link"], context);
    expect(result.exitCode).toBe(0);
    expect(context.vfs.stat("/home/study/docs-link").type).toBe("directory");
  });
});
