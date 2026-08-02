import { describe, expect, it } from "vitest";

import {
  cutCommand,
  diffCommand,
  headCommand,
  sortCommand,
  tailCommand,
  trCommand,
  uniqCommand,
  wcCommand,
} from "./textProc";
import { buildContext } from "./testFixtures";

describe("wc", () => {
  it("counts lines, words and bytes for a single file", () => {
    const context = buildContext();
    context.vfs.writeFile("/home/study/count.txt", "hello world\nfoo\n");
    const result = wcCommand(["count.txt"], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(`${"2".padStart(7)}${"3".padStart(7)}${"16".padStart(7)} count.txt\n`);
  });

  it("supports -l/-w/-c to show a single count", () => {
    const context = buildContext();
    context.vfs.writeFile("/home/study/count.txt", "hello world\nfoo\n");
    expect(wcCommand(["-l", "count.txt"], context).stdout).toBe(`${"2".padStart(7)} count.txt\n`);
    expect(wcCommand(["-w", "count.txt"], context).stdout).toBe(`${"3".padStart(7)} count.txt\n`);
  });

  it("prints a total line for multiple files", () => {
    const context = buildContext();
    context.vfs.writeFile("/home/study/a.txt", "one\n");
    context.vfs.writeFile("/home/study/b.txt", "two\nthree\n");
    const result = wcCommand(["-l", "a.txt", "b.txt"], context);
    const lines = result.stdout.trim().split("\n");
    expect(lines[lines.length - 1]).toContain("total");
  });

  it("reads from stdin when no file is given", () => {
    const context = buildContext();
    context.stdin = "one\ntwo\n";
    const result = wcCommand(["-l"], context);
    expect(result.stdout).toBe(`${"2".padStart(7)}\n`);
  });

  it("reports an error for a missing file", () => {
    const context = buildContext();
    const result = wcCommand(["nope.txt"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("No such file or directory");
  });
});

describe("sort", () => {
  it("sorts lines lexically by default", () => {
    const context = buildContext();
    context.vfs.writeFile("/home/study/names.txt", "banana\napple\ncherry\n");
    const result = sortCommand(["names.txt"], context);
    expect(result.stdout).toBe("apple\nbanana\ncherry\n");
  });

  it("sorts numerically with -n", () => {
    const context = buildContext();
    context.vfs.writeFile("/home/study/nums.txt", "10\n2\n1\n");
    const result = sortCommand(["-n", "nums.txt"], context);
    expect(result.stdout).toBe("1\n2\n10\n");
  });

  it("reverses order with -r", () => {
    const context = buildContext();
    context.vfs.writeFile("/home/study/names.txt", "banana\napple\ncherry\n");
    const result = sortCommand(["-r", "names.txt"], context);
    expect(result.stdout).toBe("cherry\nbanana\napple\n");
  });

  it("removes duplicates with -u", () => {
    const context = buildContext();
    context.vfs.writeFile("/home/study/dup.txt", "b\na\nb\na\n");
    const result = sortCommand(["-u", "dup.txt"], context);
    expect(result.stdout).toBe("a\nb\n");
  });

  it("sorts by field with -k", () => {
    const context = buildContext();
    context.vfs.writeFile("/home/study/table.txt", "b 3\na 1\nc 2\n");
    const result = sortCommand(["-k", "2", "-n", "table.txt"], context);
    expect(result.stdout).toBe("a 1\nc 2\nb 3\n");
  });

  it("reads from stdin when no file is given", () => {
    const context = buildContext();
    context.stdin = "b\na\n";
    const result = sortCommand([], context);
    expect(result.stdout).toBe("a\nb\n");
  });
});

describe("uniq", () => {
  it("collapses adjacent duplicate lines", () => {
    const context = buildContext();
    context.vfs.writeFile("/home/study/dup.txt", "a\na\nb\nb\nb\na\n");
    const result = uniqCommand(["dup.txt"], context);
    expect(result.stdout).toBe("a\nb\na\n");
  });

  it("prefixes counts with -c", () => {
    const context = buildContext();
    context.vfs.writeFile("/home/study/dup.txt", "a\na\nb\n");
    const result = uniqCommand(["-c", "dup.txt"], context);
    expect(result.stdout).toBe(`${"2".padStart(7)} a\n${"1".padStart(7)} b\n`);
  });
});

describe("cut", () => {
  it("extracts a single field with a custom delimiter", () => {
    const context = buildContext();
    context.vfs.writeFile("/home/study/score.csv", "name,score\nalice,90\nbob,80\n");
    const result = cutCommand(["-d", ",", "-f", "1", "score.csv"], context);
    expect(result.stdout).toBe("name\nalice\nbob\n");
  });

  it("supports field ranges and lists", () => {
    const context = buildContext();
    context.vfs.writeFile("/home/study/score.csv", "a,b,c,d\n");
    expect(cutCommand(["-d", ",", "-f", "2-3", "score.csv"], context).stdout).toBe("b,c\n");
    expect(cutCommand(["-d", ",", "-f", "1,3", "score.csv"], context).stdout).toBe("a,c\n");
  });

  it("fails when no field list is given", () => {
    const context = buildContext();
    const result = cutCommand(["score.csv"], context);
    expect(result.exitCode).toBe(1);
  });
});

describe("tr", () => {
  it("translates characters from set1 to set2", () => {
    const context = buildContext();
    context.stdin = "hello";
    const result = trCommand(["a-z", "A-Z"], context);
    expect(result.stdout).toBe("HELLO");
  });

  it("deletes characters with -d", () => {
    const context = buildContext();
    context.stdin = "hello world";
    const result = trCommand(["-d", "lo"], context);
    expect(result.stdout).toBe("he wrd");
  });
});

describe("head", () => {
  it("shows the first N lines", () => {
    const context = buildContext();
    context.vfs.writeFile("/home/study/many.txt", "1\n2\n3\n4\n5\n");
    const result = headCommand(["-n", "2", "many.txt"], context);
    expect(result.stdout).toBe("1\n2\n");
  });

  it("defaults to 10 lines", () => {
    const context = buildContext();
    const content = Array.from({ length: 15 }, (_, i) => String(i + 1)).join("\n") + "\n";
    context.vfs.writeFile("/home/study/many.txt", content);
    const result = headCommand(["many.txt"], context);
    expect(result.stdout.trim().split("\n")).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
  });
});

describe("tail", () => {
  it("shows the last N lines", () => {
    const context = buildContext();
    context.vfs.writeFile("/home/study/many.txt", "1\n2\n3\n4\n5\n");
    const result = tailCommand(["-n", "2", "many.txt"], context);
    expect(result.stdout).toBe("4\n5\n");
  });

  it("does not error with -f (simulated follow)", () => {
    const context = buildContext();
    context.vfs.writeFile("/home/study/many.txt", "1\n2\n3\n");
    const result = tailCommand(["-f", "many.txt"], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("1\n2\n3\n");
  });
});

describe("diff", () => {
  it("prints nothing and exits 0 for identical files", () => {
    const context = buildContext();
    context.vfs.writeFile("/home/study/a.txt", "same\n");
    context.vfs.writeFile("/home/study/b.txt", "same\n");
    const result = diffCommand(["a.txt", "b.txt"], context);
    expect(result).toEqual({ stdout: "", stderr: "", exitCode: 0 });
  });

  it("prints a default-format diff and exits 1 for differing files", () => {
    const context = buildContext();
    context.vfs.writeFile("/home/study/a.txt", "one\ntwo\nthree\n");
    context.vfs.writeFile("/home/study/b.txt", "one\ntwo-changed\nthree\n");
    const result = diffCommand(["a.txt", "b.txt"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("2c2\n< two\n---\n> two-changed\n");
  });

  it("prints a unified diff with -u", () => {
    const context = buildContext();
    context.vfs.writeFile("/home/study/a.txt", "one\ntwo\nthree\n");
    context.vfs.writeFile("/home/study/b.txt", "one\ntwo-changed\nthree\n");
    const result = diffCommand(["-u", "a.txt", "b.txt"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe(
      "--- a.txt\n+++ b.txt\n@@ -1,3 +1,3 @@\n one\n-two\n+two-changed\n three\n",
    );
  });

  it("reports an error when a file does not exist", () => {
    const context = buildContext();
    context.vfs.writeFile("/home/study/a.txt", "one\n");
    const result = diffCommand(["a.txt", "nope.txt"], context);
    expect(result.exitCode).toBe(2);
  });
});
