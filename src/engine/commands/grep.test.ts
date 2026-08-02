import { describe, expect, it } from "vitest";

import { grepCommand } from "./grep";
import { buildContext } from "./testFixtures";

const SAMPLE_CONTENT = "apple\nBanana\ncherry\napple pie\n";

function withSampleFile(): ReturnType<typeof buildContext> {
  const context = buildContext();
  context.vfs.writeFile("/home/study/sample.txt", SAMPLE_CONTENT);
  return context;
}

describe("grep", () => {
  it("prints matching lines and exits 0", () => {
    const context = withSampleFile();
    const result = grepCommand(["apple", "sample.txt"], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("apple\napple pie\n");
    expect(result.stderr).toBe("");
  });

  it("exits 1 and prints nothing when there is no match", () => {
    const context = withSampleFile();
    const result = grepCommand(["mango", "sample.txt"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
  });

  it("-i matches case-insensitively", () => {
    const context = withSampleFile();
    const result = grepCommand(["-i", "banana", "sample.txt"], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("Banana\n");
  });

  it("-n prefixes matches with their 1-based line number", () => {
    const context = withSampleFile();
    const result = grepCommand(["-n", "apple", "sample.txt"], context);
    expect(result.stdout).toBe("1:apple\n4:apple pie\n");
  });

  it("-v inverts the match, printing non-matching lines", () => {
    const context = withSampleFile();
    const result = grepCommand(["-v", "apple", "sample.txt"], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("Banana\ncherry\n");
  });

  it("combines -n and -v", () => {
    const context = withSampleFile();
    const result = grepCommand(["-nv", "apple", "sample.txt"], context);
    expect(result.stdout).toBe("2:Banana\n3:cherry\n");
  });

  it("-E enables extended regular expressions", () => {
    const context = withSampleFile();
    const result = grepCommand(["-E", "^(Banana|cherry)$", "sample.txt"], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("Banana\ncherry\n");
  });

  it("without -E, extended metacharacters are treated as literals (no match)", () => {
    const context = withSampleFile();
    const result = grepCommand(["^(Banana|cherry)$", "sample.txt"], context);
    expect(result.exitCode).toBe(1);
  });

  it("prefixes output with the filename when searching multiple files", () => {
    const context = withSampleFile();
    context.vfs.writeFile("/home/study/other.txt", "apple sauce\n");
    const result = grepCommand(["apple", "sample.txt", "other.txt"], context);
    expect(result.stdout).toBe("sample.txt:apple\nsample.txt:apple pie\nother.txt:apple sauce\n");
  });

  it("fails with usage error when no pattern is given", () => {
    const context = withSampleFile();
    const result = grepCommand([], context);
    expect(result.exitCode).toBe(2);
  });

  it("fails with usage error when no file is given", () => {
    const context = withSampleFile();
    const result = grepCommand(["apple"], context);
    expect(result.exitCode).toBe(2);
  });

  it("reports an error and exits 2 for a non-existent file", () => {
    const context = withSampleFile();
    const result = grepCommand(["apple", "nope.txt"], context);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("No such file or directory");
  });

  it("reports an error for a directory argument", () => {
    const context = withSampleFile();
    const result = grepCommand(["apple", "docs"], context);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Is a directory");
  });

  it("continues matching remaining files after an error and still reports matches", () => {
    const context = withSampleFile();
    const result = grepCommand(["apple", "nope.txt", "sample.txt"], context);
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("sample.txt:apple\nsample.txt:apple pie\n");
    expect(result.stderr).toContain("No such file or directory");
  });

  it("rejects an invalid regular expression", () => {
    const context = withSampleFile();
    const result = grepCommand(["-E", "a(b", "sample.txt"], context);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("grep:");
  });
});
