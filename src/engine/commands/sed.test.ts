import { describe, expect, it } from "vitest";

import { sedCommand } from "./sed";
import { buildContext } from "./testFixtures";
import type { CommandContext } from "./types";

const DRINK2 = "drink2.txt";
const SCORE = "score.txt";

/** Ch14演習(sed/awk)向けのサンプルファイルを共有VFSスナップショットに追加したコンテキストを作る。 */
function buildTextprocContext(): CommandContext {
  const context = buildContext();
  context.vfs.writeFile(
    `${context.cwd}/${DRINK2}`,
    "Beer,500,Japan\nWine,750,France\nWhisky,700,Scotland\nSake,720,Japan\nVodka,700,Russia\n",
  );
  context.vfs.writeFile(`${context.cwd}/${SCORE}`, "Yamada 80 90 70\nSato 65 70 60\nSuzuki 92 88 95\n");
  return context;
}

describe("sed", () => {
  it("substitutes the first match per line by default", () => {
    const context = buildTextprocContext();
    const result = sedCommand(["s/Japan/JPN/", DRINK2], context);
    expect(result.exitCode).toBe(0);
    const lines = result.stdout.split("\n");
    expect(lines).toContain("Beer,500,JPN");
    expect(lines).toContain("Sake,720,JPN");
  });

  it("substitutes every match on a line with the g flag", () => {
    const context = buildTextprocContext();
    const result = sedCommand(["s/[0-9]\\+/X/g", SCORE], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Yamada X X X");
    expect(result.stdout).toContain("Sato X X X");
  });

  it("supports backreferences in the replacement", () => {
    const context = buildTextprocContext();
    const result = sedCommand(["s/\\(.*\\),\\(.*\\),\\(.*\\)/\\3,\\2,\\1/", DRINK2], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Japan,500,Beer");
    expect(result.stdout).toContain("Russia,700,Vodka");
  });

  it("deletes a line addressed by line number", () => {
    const context = buildTextprocContext();
    const result = sedCommand(["2d", DRINK2], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("Wine");
    expect(result.stdout).toContain("Beer,500,Japan");
  });

  it("deletes lines addressed by a regular expression", () => {
    const context = buildTextprocContext();
    const result = sedCommand(["/Whisky/d", DRINK2], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("Whisky");
    expect(result.stdout).toContain("Sake,720,Japan");
  });

  it("deletes a range of lines", () => {
    const context = buildTextprocContext();
    const result = sedCommand(["2,4d", DRINK2], context);
    expect(result.exitCode).toBe(0);
    const lines = result.stdout.trim().split("\n");
    expect(lines).toEqual(["Beer,500,Japan", "Vodka,700,Russia"]);
  });

  it("suppresses auto-print with -n and prints only matched lines with p", () => {
    const context = buildTextprocContext();
    const result = sedCommand(["-n", "2p", DRINK2], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("Wine,750,France\n");
  });

  it("negates an address with !", () => {
    const context = buildTextprocContext();
    const result = sedCommand(["-n", "2!p", DRINK2], context);
    expect(result.exitCode).toBe(0);
    const lines = result.stdout.trim().split("\n");
    expect(lines).toEqual(["Beer,500,Japan", "Whisky,700,Scotland", "Sake,720,Japan", "Vodka,700,Russia"]);
  });

  it("matches the last line with $", () => {
    const context = buildTextprocContext();
    const result = sedCommand(["-n", "$p", DRINK2], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("Vodka,700,Russia\n");
  });

  it("fails when no file operand is given", () => {
    const context = buildTextprocContext();
    const result = sedCommand(["s/a/b/"], context);
    expect(result.exitCode).toBe(1);
  });

  it("fails for a non-existent file", () => {
    const context = buildTextprocContext();
    const result = sedCommand(["s/a/b/", "nope.txt"], context);
    expect(result.exitCode).toBe(1);
  });
});
