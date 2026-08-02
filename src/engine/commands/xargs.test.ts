import { describe, expect, it } from "vitest";

import { buildContext } from "./testFixtures";
import { xargsCommand } from "./xargs";

describe("xargs", () => {
  it("defaults to echo, passing every whitespace-separated stdin item as one invocation", () => {
    const context = { ...buildContext(), stdin: "a b  c\n" };
    expect(xargsCommand([], context)).toEqual({ stdout: "a b c\n", stderr: "", exitCode: 0 });
  });

  it("runs the given command with the stdin items appended to its own initial arguments", () => {
    const context = { ...buildContext(), stdin: "a b\n" };
    const result = xargsCommand(["echo", "prefix:"], context);
    expect(result.stdout).toBe("prefix: a b\n");
    expect(result.exitCode).toBe(0);
  });

  it("does nothing (exit code 0) when stdin is empty", () => {
    const context = { ...buildContext(), stdin: "" };
    expect(xargsCommand(["rm"], context)).toEqual({ stdout: "", stderr: "", exitCode: 0 });
  });

  it("-n limits the number of items passed per invocation", () => {
    const context = { ...buildContext(), stdin: "a b c d e\n" };
    const result = xargsCommand(["-n", "2", "echo"], context);
    expect(result.stdout).toBe("a b\nc d\ne\n");
  });

  it("-I replaces the placeholder in the trailing args, once per item", () => {
    const context = { ...buildContext(), stdin: "a\nb\n" };
    const result = xargsCommand(["-I", "{}", "echo", "[{}]"], context);
    expect(result.stdout).toBe("[a]\n[b]\n");
  });

  it("-d splits stdin using a custom single-character delimiter instead of whitespace", () => {
    const context = { ...buildContext(), stdin: "a:b:c" };
    const result = xargsCommand(["-d", ":", "echo"], context);
    expect(result.stdout).toBe("a b c\n");
  });

  it("respects quoting within the default whitespace-separated tokenizer", () => {
    const context = { ...buildContext(), stdin: "'a b' c\n" };
    const result = xargsCommand(["-n", "1", "echo"], context);
    expect(result.stdout).toBe("a b\nc\n");
  });

  it("reports exit code 123 if any invocation fails, but still runs the rest", () => {
    const context = { ...buildContext(), stdin: "missing.txt file1.txt\n" };
    const result = xargsCommand(["-n", "1", "cat"], context);
    expect(result.stdout).toBe("hello\n");
    expect(result.stderr).toContain("No such file or directory");
    expect(result.exitCode).toBe(123);
  });

  it("rejects a non-numeric -n value", () => {
    const context = { ...buildContext(), stdin: "a\n" };
    const result = xargsCommand(["-n", "abc", "echo"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("-n");
  });
});
