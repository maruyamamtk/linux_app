import { describe, expect, it } from "vitest";

import { chmodCommand, parseMode, suCommand, sudoCommand } from "./permissions";
import { touchCommand } from "./fileOps";
import { ROOT_USER, STUDY_USER, buildContext } from "./testFixtures";

describe("parseMode", () => {
  it("parses a 3-digit numeric mode", () => {
    expect(parseMode("755", 0o644)).toBe(0o755);
  });

  it("parses a 4-digit numeric mode by masking to 9 bits", () => {
    expect(parseMode("4755", 0o644)).toBe(0o755);
  });

  it("adds a permission for the given target with +", () => {
    expect(parseMode("u+x", 0o644)).toBe(0o744);
  });

  it("removes a permission for the given target with -", () => {
    expect(parseMode("go-w", 0o666)).toBe(0o644);
  });

  it("sets the exact permission for the given target with =", () => {
    expect(parseMode("u=rwx,go=rx", 0o600)).toBe(0o755);
  });

  it("defaults to all targets when none are specified", () => {
    expect(parseMode("+x", 0o644)).toBe(0o755);
  });

  it("applies comma-separated clauses in order", () => {
    expect(parseMode("u+x,g+x", 0o644)).toBe(0o754);
  });
});

describe("chmod", () => {
  it("changes the mode with a numeric mode", () => {
    const context = buildContext();
    const result = chmodCommand(["600", "file1.txt"], context);
    expect(result.exitCode).toBe(0);
    expect(context.vfs.stat("/home/study/file1.txt").mode).toBe(0o600);
  });

  it("changes the mode with a symbolic mode", () => {
    const context = buildContext();
    const result = chmodCommand(["u+x", "file1.txt"], context);
    expect(result.exitCode).toBe(0);
    expect(context.vfs.stat("/home/study/file1.txt").mode).toBe(0o744);
  });

  it("rejects an invalid mode string", () => {
    const context = buildContext();
    const result = chmodCommand(["notamode", "file1.txt"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("invalid mode");
  });

  it("fails when a non-owner tries to change the mode without root", () => {
    const context = buildContext();
    const otherOwned = chmodCommand(["600", "/etc/passwd"], context);
    expect(otherOwned.exitCode).toBe(1);
    expect(otherOwned.stderr).toContain("Permission denied");
  });

  it("allows root to change the mode of a file it does not own", () => {
    const context = buildContext(ROOT_USER, "/home/study");
    const result = chmodCommand(["600", "/etc/passwd"], context);
    expect(result.exitCode).toBe(0);
    expect(context.vfs.stat("/etc/passwd").mode).toBe(0o600);
  });
});

describe("su", () => {
  it("switches to root by default", () => {
    const context = buildContext();
    suCommand([], context);
    expect(context.vfs.getUser()).toEqual({ name: "root", groups: ["root"], isRoot: true });
  });

  it("switches to a named non-root user", () => {
    const context = buildContext();
    suCommand(["guest"], context);
    expect(context.vfs.getUser()).toEqual({ name: "guest", groups: ["guest"] });
  });

  it("lets subsequent commands write to root-owned paths after switching to root", () => {
    const context = buildContext();
    const beforeSu = touchCommand(["/etc/newfile"], context);
    expect(beforeSu.exitCode).toBe(1);

    suCommand([], context);
    const afterSu = touchCommand(["/etc/newfile"], context);
    expect(afterSu.exitCode).toBe(0);
    expect(context.vfs.exists("/etc/newfile")).toBe(true);
  });
});

describe("sudo", () => {
  it("runs a single command as root and then restores the original user", () => {
    const context = buildContext();
    const result = sudoCommand(["touch", "/etc/newfile"], context);
    expect(result.exitCode).toBe(0);
    expect(context.vfs.exists("/etc/newfile")).toBe(true);
    expect(context.vfs.getUser()).toEqual(STUDY_USER);
  });

  it("restores the original user even when the wrapped command still fails", () => {
    const context = buildContext();
    const result = sudoCommand(["cd", "/nope"], context);
    expect(result.exitCode).toBe(1);
    expect(context.vfs.getUser()).toEqual(STUDY_USER);
  });

  it("fails without a permission error for a plain (non-sudo) write to /etc", () => {
    const context = buildContext();
    const result = touchCommand(["/etc/newfile"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Permission denied");
  });

  it("requires a command argument", () => {
    const context = buildContext();
    const result = sudoCommand([], context);
    expect(result.exitCode).toBe(1);
  });

  it("propagates command-not-found style errors from the underlying registry", () => {
    const context = buildContext();
    const result = sudoCommand(["frobnicate"], context);
    expect(result.exitCode).toBe(127);
  });
});
