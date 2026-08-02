import { describe, expect, it } from "vitest";

import { awkCommand } from "./awk";
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

describe("awk", () => {
  it("prints a field for every line by default (no pattern)", () => {
    const context = buildTextprocContext();
    const result = awkCommand(["{ print $1 }", SCORE], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("Yamada\nSato\nSuzuki\n");
  });

  it("prints multiple fields joined by OFS", () => {
    const context = buildTextprocContext();
    const result = awkCommand(["{ print $1, $2 }", SCORE], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("Yamada 80\nSato 65\nSuzuki 92\n");
  });

  it("supports $NF to reference the last field", () => {
    const context = buildTextprocContext();
    const result = awkCommand(["{ print $NF }", SCORE], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("70\n60\n95\n");
  });

  it("filters lines with a comparison pattern on NR", () => {
    const context = buildTextprocContext();
    const result = awkCommand(["NR==2{print $1}", SCORE], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("Sato\n");
  });

  it("filters lines with a regex pattern (defaults to printing $0)", () => {
    const context = buildTextprocContext();
    const result = awkCommand(["/Wine/", DRINK2], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("Wine,750,France\n");
  });

  it("supports a field match with ~", () => {
    const context = buildTextprocContext();
    const result = awkCommand(["-F", ",", "$3 ~ /Japan/{ print $1 }", DRINK2], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("Beer\nSake\n");
  });

  it("splits on a custom field separator with -F", () => {
    const context = buildTextprocContext();
    const result = awkCommand(["-F", ",", "{ print $3 }", DRINK2], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("Japan\nFrance\nScotland\nJapan\nRussia\n");
  });

  it("accumulates a value across records and prints it in an END block", () => {
    const context = buildTextprocContext();
    const result = awkCommand(["{ sum += $2 } END { print sum }", SCORE], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("237\n");
  });

  it("runs a BEGIN block once before processing records", () => {
    const context = buildTextprocContext();
    const result = awkCommand(["BEGIN { print \"start\" } { print $1 } END { print \"end\" }", SCORE], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("start\nYamada\nSato\nSuzuki\nend\n");
  });

  it("fails when no file operand is given", () => {
    const context = buildTextprocContext();
    const result = awkCommand(["{ print }"], context);
    expect(result.exitCode).toBe(1);
  });

  it("fails for a non-existent file", () => {
    const context = buildTextprocContext();
    const result = awkCommand(["{ print }", "nope.txt"], context);
    expect(result.exitCode).toBe(1);
  });
});
