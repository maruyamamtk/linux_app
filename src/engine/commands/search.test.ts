import { describe, expect, it } from "vitest";

import { findCommand, helpCommand, locateCommand, manCommand, whichCommand } from "./search";
import { buildContext } from "./testFixtures";

describe("find", () => {
  it("recursively lists every path under the start directory by default", () => {
    const context = buildContext();
    const result = findCommand(["."], context);
    expect(result.exitCode).toBe(0);
    const lines = result.stdout.trim().split("\n");
    expect(lines).toContain("/home/study/docs/a.txt");
    expect(lines).toContain("/home/study/file1.txt");
  });

  it("filters by -name glob pattern", () => {
    const context = buildContext();
    const result = findCommand([".", "-name", "*.txt"], context);
    const lines = result.stdout.trim().split("\n");
    expect(lines.every((line) => line.endsWith(".txt"))).toBe(true);
    expect(lines).toContain("/home/study/file1.txt");
    expect(lines).not.toContain("/home/study/docs");
  });

  it("filters by -type d", () => {
    const context = buildContext();
    const result = findCommand([".", "-type", "d"], context);
    const lines = result.stdout.trim().split("\n");
    expect(lines).toContain("/home/study/docs");
    expect(lines).not.toContain("/home/study/file1.txt");
  });

  it("fails for a non-existent start path", () => {
    const context = buildContext();
    const result = findCommand(["nope"], context);
    expect(result.exitCode).toBe(1);
  });
});

describe("locate", () => {
  it("finds paths anywhere in the filesystem by substring", () => {
    const context = buildContext();
    const result = locateCommand(["passwd"], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("/etc/passwd");
  });

  it("exits 1 when nothing matches", () => {
    const context = buildContext();
    const result = locateCommand(["does-not-exist"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
  });
});

describe("which", () => {
  it("finds a command on PATH", () => {
    const context = buildContext();
    const result = whichCommand(["ls"], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("/bin/ls");
  });

  it("exits 1 for a command that is not on PATH", () => {
    const context = buildContext();
    const result = whichCommand(["nonexistent"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
  });
});

describe("man", () => {
  it("prints a manual page for a known command", () => {
    const context = buildContext();
    const result = manCommand(["ls"], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("NAME");
    expect(result.stdout).toContain("ls");
  });

  it("fails for an unknown command", () => {
    const context = buildContext();
    const result = manCommand(["nonexistent"], context);
    expect(result.exitCode).toBe(1);
  });
});

describe("help", () => {
  it("lists all built-in commands", () => {
    const context = buildContext();
    const result = helpCommand([], context);
    for (const name of ["pwd", "cd", "ls", "mkdir", "touch", "rm", "rmdir", "cp", "mv", "ln", "find", "locate", "which", "grep", "man", "help"]) {
      expect(result.stdout).toContain(name);
    }
  });
});
