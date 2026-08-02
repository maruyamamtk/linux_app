import { describe, expect, it } from "vitest";

import { commandRegistry, executeCommand, isKnownCommand, resolveCommand } from "./registry";
import { buildContext } from "./testFixtures";

const EXPECTED_COMMANDS = [
  "pwd",
  "cd",
  "ls",
  "mkdir",
  "touch",
  "rm",
  "rmdir",
  "cp",
  "mv",
  "ln",
  "find",
  "locate",
  "which",
  "grep",
  "man",
  "help",
  "wc",
  "sort",
  "uniq",
  "cut",
  "tr",
  "head",
  "tail",
  "diff",
  "sed",
  "awk",
];

describe("commandRegistry", () => {
  it("registers every VFS operation / search command from the requirements doc", () => {
    for (const name of EXPECTED_COMMANDS) {
      expect(resolveCommand(name)).toBeTypeOf("function");
      expect(isKnownCommand(name)).toBe(true);
    }
    expect(Object.keys(commandRegistry).sort()).toEqual([...EXPECTED_COMMANDS].sort());
  });
});

describe("executeCommand", () => {
  it("dispatches to the registered implementation", () => {
    const context = buildContext(undefined, "/home/study");
    const result = executeCommand("pwd", [], context);
    expect(result).toEqual({ stdout: "/home/study\n", stderr: "", exitCode: 0 });
  });

  it("returns exit code 127 for an unknown command", () => {
    const context = buildContext();
    const result = executeCommand("frobnicate", [], context);
    expect(result.exitCode).toBe(127);
    expect(result.stderr).toContain("command not found");
  });
});
