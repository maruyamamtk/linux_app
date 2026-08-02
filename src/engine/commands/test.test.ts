import { describe, expect, it } from "vitest";

import { bracketCommand, testCommand } from "./test";
import { buildContext } from "./testFixtures";

describe("test: 単項演算子", () => {
  it("-z / -n はスペース区切りではなく単一の文字列引数を判定する", () => {
    const context = buildContext();
    expect(testCommand(["-z", ""], context).exitCode).toBe(0);
    expect(testCommand(["-z", "a"], context).exitCode).toBe(1);
    expect(testCommand(["-n", "a"], context).exitCode).toBe(0);
    expect(testCommand(["-n", ""], context).exitCode).toBe(1);
  });

  it("単一の引数だけの場合は非空文字列かどうかを判定する", () => {
    const context = buildContext();
    expect(testCommand(["a"], context).exitCode).toBe(0);
    expect(testCommand([""], context).exitCode).toBe(1);
  });

  it("-e / -f / -d はファイルの存在・種別を判定する", () => {
    const context = buildContext();
    expect(testCommand(["-e", "file1.txt"], context).exitCode).toBe(0);
    expect(testCommand(["-e", "nope.txt"], context).exitCode).toBe(1);
    expect(testCommand(["-f", "file1.txt"], context).exitCode).toBe(0);
    expect(testCommand(["-f", "docs"], context).exitCode).toBe(1);
    expect(testCommand(["-d", "docs"], context).exitCode).toBe(0);
    expect(testCommand(["-d", "file1.txt"], context).exitCode).toBe(1);
  });

  it("-s は中身のあるファイルを判定する", () => {
    const context = buildContext();
    expect(testCommand(["-s", "file1.txt"], context).exitCode).toBe(0);
    expect(testCommand(["-s", "empty"], context).exitCode).toBe(1);
  });

  it("-r / -w / -x はowner/group/otherのパーミッションビットを判定する", () => {
    const context = buildContext();
    // file1.txt は study:study, mode 644 (rw-r--r--) の所有者一致。
    expect(testCommand(["-r", "file1.txt"], context).exitCode).toBe(0);
    expect(testCommand(["-w", "file1.txt"], context).exitCode).toBe(0);
    expect(testCommand(["-x", "file1.txt"], context).exitCode).toBe(1);
    // /bin/ls は root:root, mode 755 (rwxr-xr-x) で study は other。
    expect(testCommand(["-r", "/bin/ls"], context).exitCode).toBe(0);
    expect(testCommand(["-w", "/bin/ls"], context).exitCode).toBe(1);
    expect(testCommand(["-x", "/bin/ls"], context).exitCode).toBe(0);
  });

  it("! で結果を反転する", () => {
    const context = buildContext();
    expect(testCommand(["!", "-f", "file1.txt"], context).exitCode).toBe(1);
    expect(testCommand(["!", "-f", "nope.txt"], context).exitCode).toBe(0);
  });
});

describe("test: 二項演算子", () => {
  it("= / != は文字列比較を行う", () => {
    const context = buildContext();
    expect(testCommand(["abc", "=", "abc"], context).exitCode).toBe(0);
    expect(testCommand(["abc", "=", "def"], context).exitCode).toBe(1);
    expect(testCommand(["abc", "!=", "def"], context).exitCode).toBe(0);
  });

  it("-eq -ne -lt -le -gt -ge は整数比較を行う", () => {
    const context = buildContext();
    expect(testCommand(["3", "-eq", "3"], context).exitCode).toBe(0);
    expect(testCommand(["3", "-ne", "4"], context).exitCode).toBe(0);
    expect(testCommand(["3", "-lt", "4"], context).exitCode).toBe(0);
    expect(testCommand(["4", "-le", "4"], context).exitCode).toBe(0);
    expect(testCommand(["5", "-gt", "4"], context).exitCode).toBe(0);
    expect(testCommand(["5", "-ge", "5"], context).exitCode).toBe(0);
    expect(testCommand(["3", "-gt", "4"], context).exitCode).toBe(1);
  });

  it("整数として解釈できない場合はエラー(終了ステータス2)になる", () => {
    const context = buildContext();
    const result = testCommand(["abc", "-eq", "3"], context);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("integer expression expected");
  });
});

describe("[ (bracketCommand)", () => {
  it("末尾に ] が必要で、無ければエラー(終了ステータス2)になる", () => {
    const context = buildContext();
    const result = bracketCommand(["-f", "file1.txt"], context);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("missing ']'");
  });

  it("] を取り除いた上でtestと同じ判定を行う", () => {
    const context = buildContext();
    expect(bracketCommand(["-f", "file1.txt", "]"], context).exitCode).toBe(0);
    expect(bracketCommand(["-f", "nope.txt", "]"], context).exitCode).toBe(1);
  });
});
