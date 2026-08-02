import { describe, expect, it } from "vitest";

import { bgCommand, fgCommand, jobsCommand, killCommand, psCommand } from "./process";
import { ROOT_USER, buildContext } from "./testFixtures";

describe("ps", () => {
  it("lists only the current user's processes by default", () => {
    const context = buildContext();
    const result = psCommand([], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("bash");
    expect(result.stdout).toContain("sleep 100");
    expect(result.stdout).not.toContain("sshd");
  });

  it("lists every user's processes with -e", () => {
    const context = buildContext();
    const result = psCommand(["-e"], context);
    expect(result.stdout).toContain("sshd");
  });
});

describe("jobs", () => {
  it("lists background/stopped jobs with job numbers", () => {
    const context = buildContext();
    const result = jobsCommand([], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("[1]-  Running");
    expect(result.stdout).toContain("[2]+  Stopped");
    expect(result.stdout).toContain("sleep 100");
    expect(result.stdout).toContain("vim memo.txt");
  });

  it("prints nothing when there are no jobs", () => {
    const context = buildContext();
    context.processes = context.processes.filter((process) => process.jobId === undefined);
    const result = jobsCommand([], context);
    expect(result).toEqual({ stdout: "", stderr: "", exitCode: 0 });
  });
});

describe("fg", () => {
  it("brings the current job to the foreground by default", () => {
    const context = buildContext();
    const result = fgCommand([], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("vim memo.txt\n");
    const job = context.processes.find((process) => process.pid === 101);
    expect(job?.status).toBe("running");
    expect(job?.jobId).toBeUndefined();
  });

  it("brings a specific job to the foreground with %N", () => {
    const context = buildContext();
    const result = fgCommand(["%1"], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("sleep 100\n");
  });

  it("fails for an unknown job", () => {
    const context = buildContext();
    const result = fgCommand(["%9"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("no such job");
  });
});

describe("bg", () => {
  it("resumes a stopped job in the background", () => {
    const context = buildContext();
    const result = bgCommand(["%2"], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("vim memo.txt &");
    const job = context.processes.find((process) => process.pid === 101);
    expect(job?.status).toBe("running");
    expect(job?.jobId).toBe(2);
  });

  it("fails when the job is already running in the background", () => {
    const context = buildContext();
    const result = bgCommand(["%1"], context);
    expect(result.exitCode).toBe(1);
  });
});

describe("kill", () => {
  it("removes a process by PID", () => {
    const context = buildContext();
    const result = killCommand(["100"], context);
    expect(result.exitCode).toBe(0);
    expect(context.processes.some((process) => process.pid === 100)).toBe(false);
  });

  it("removes a job by %N", () => {
    const context = buildContext();
    const result = killCommand(["%2"], context);
    expect(result.exitCode).toBe(0);
    expect(context.processes.some((process) => process.pid === 101)).toBe(false);
  });

  it("fails for a non-existent PID", () => {
    const context = buildContext();
    const result = killCommand(["9999"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("No such process");
  });

  it("refuses to kill another user's process without root", () => {
    const context = buildContext();
    const result = killCommand(["2"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Operation not permitted");
    expect(context.processes.some((process) => process.pid === 2)).toBe(true);
  });

  it("allows root to kill any user's process", () => {
    const context = buildContext(ROOT_USER, "/home/study");
    const result = killCommand(["2"], context);
    expect(result.exitCode).toBe(0);
    expect(context.processes.some((process) => process.pid === 2)).toBe(false);
  });
});
