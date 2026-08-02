import { describe, expect, it } from "vitest";

import { parseArgs } from "./args";

describe("parseArgs", () => {
  it("splits combined single-character flags", () => {
    const { flags, positional } = parseArgs(["-rf", "target"]);
    expect(flags.has("r")).toBe(true);
    expect(flags.has("f")).toBe(true);
    expect(positional).toEqual(["target"]);
  });

  it("recognizes long options", () => {
    const { flags } = parseArgs(["--recursive", "--force"]);
    expect(flags.has("recursive")).toBe(true);
    expect(flags.has("force")).toBe(true);
  });

  it("treats everything after '--' as positional", () => {
    const { flags, positional } = parseArgs(["-l", "--", "-not-a-flag"]);
    expect(flags.has("l")).toBe(true);
    expect(positional).toEqual(["-not-a-flag"]);
  });

  it("keeps arguments without options as positional", () => {
    const { flags, positional } = parseArgs(["a.txt", "b.txt"]);
    expect(flags.size).toBe(0);
    expect(positional).toEqual(["a.txt", "b.txt"]);
  });
});
