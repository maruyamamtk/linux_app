import { describe, expect, it } from "vitest";

import { executeShellInput } from "../interpreter";
import { sshCommand } from "./ssh";
import { buildContext } from "./testFixtures";

describe("ssh", () => {
  it("fails without a target", () => {
    const result = sshCommand([], buildContext());
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("usage: ssh");
  });

  it("fails for an unknown host", () => {
    const result = sshCommand(["study@no-such-host"], buildContext());
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Could not resolve hostname");
  });

  it("connects to the registered virtual remote host and switches the VFS/cwd/prompt state", () => {
    const context = buildContext();
    const result = sshCommand(["study@webserver"], context);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Last login:");
    expect(context.ssh.remoteHost).toBe("webserver");
    expect(context.cwd).toBe("/home/study");
    expect(context.vfs.readFile("/etc/hostname")).toBe("webserver\n");
    expect(context.vfs.exists("/home/study/file1.txt")).toBe(false);
    expect(context.vfs.exists("/home/study/deploy/README.md")).toBe(true);
  });

  it("accepts a host without an explicit user", () => {
    const result = sshCommand(["webserver"], buildContext());
    expect(result.exitCode).toBe(0);
  });

  it("refuses to connect again while already connected", () => {
    const context = buildContext();
    sshCommand(["study@webserver"], context);
    const result = sshCommand(["study@webserver"], context);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("already connected");
  });
});

describe("ssh + exit (interpreter round trip)", () => {
  it("switches to the remote host's VFS for subsequent commands on the same line", () => {
    const context = buildContext();
    const result = executeShellInput("ssh study@webserver; cat /etc/hostname", context);
    expect(result.stdout).toContain("webserver");
    expect(result.stderr).toBe("");
  });

  it("`exit` logs out of the remote host and restores the local session", () => {
    const context = buildContext();
    const before = executeShellInput("pwd", context);

    const result = executeShellInput("ssh study@webserver; exit; pwd", context);

    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Connection to webserver closed");
    expect(result.stdout.trimEnd().endsWith(before.stdout.trimEnd())).toBe(true);
    expect(context.ssh.remoteHost).toBeUndefined();
    expect(context.vfs.exists("/home/study/file1.txt")).toBe(true);
    expect(context.vfs.exists("/home/study/deploy/README.md")).toBe(false);
  });
});
