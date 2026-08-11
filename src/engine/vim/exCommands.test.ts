import { describe, expect, it } from "vitest";

import { parseExCommand, runExCommand } from "./exCommands";
import { VimExCommandError } from "./errors";
import { createEmptyPending } from "./types";
import type { VimBuffer, VimState } from "./types";

function buffer(...lines: string[]): VimBuffer {
  return { lines };
}

function stateWith(buf: VimBuffer, commandLine: string, cursorLine = 0): VimState {
  return {
    mode: "cmdline",
    buffer: buf,
    cursor: { line: cursorLine, col: 0 },
    register: { content: "", linewise: false },
    pending: createEmptyPending(),
    commandLine,
    statusMessage: null,
    undoStack: [],
    redoStack: [],
    keyLog: [],
  };
}

describe("parseExCommand", () => {
  it("数字のみは行移動として解釈する", () => {
    expect(parseExCommand("5")).toEqual({ type: "goto", line: 5 });
  });

  it("w/q/wq を解釈する", () => {
    expect(parseExCommand("w")).toEqual({ type: "write" });
    expect(parseExCommand("q")).toEqual({ type: "quit" });
    expect(parseExCommand("wq")).toEqual({ type: "writequit" });
  });

  it("空文字列はエラーを投げる", () => {
    expect(() => parseExCommand("")).toThrow(VimExCommandError);
  });

  it("未対応コマンドはエラーを投げる", () => {
    expect(() => parseExCommand("xyz")).toThrow(VimExCommandError);
  });

  it("不正な正規表現は素のSyntaxErrorではなくVimExCommandErrorとして投げる", () => {
    expect(() => parseExCommand("s/[/x/")).toThrow(VimExCommandError);
  });

  it("s/old/new/ をパースする(範囲なし)", () => {
    const parsed = parseExCommand("s/foo/bar/");
    expect(parsed.type).toBe("substitute");
    if (parsed.type === "substitute") {
      expect(parsed.range).toBeUndefined();
      expect(parsed.regex.global).toBe(false);
      expect("xfoox".replace(parsed.regex, parsed.replacement)).toBe("xbarx");
    }
  });

  it("%s/old/new/g は 1,$ の範囲になる", () => {
    const parsed = parseExCommand("%s/foo/bar/g");
    expect(parsed.type).toBe("substitute");
    if (parsed.type === "substitute") {
      expect(parsed.range).toEqual({ start: 1, end: "last" });
      expect(parsed.regex.global).toBe(true);
    }
  });

  it("{n},{m}s/old/new/ は行範囲になる", () => {
    const parsed = parseExCommand("2,4s/foo/bar/");
    expect(parsed.type).toBe("substitute");
    if (parsed.type === "substitute") {
      expect(parsed.range).toEqual({ start: 2, end: 4 });
    }
  });
});

describe("runExCommand", () => {
  it(":5 のようなgotoは範囲外だとエラーメッセージを返しカーソルを変更しない", () => {
    const state = stateWith(buffer("a", "b"), "5");
    const result = runExCommand(state);
    expect(result.statusMessage?.isError).toBe(true);
    expect(result.cursor).toEqual({ line: 0, col: 0 });
  });

  it(":s は現在行のみを対象にする(範囲省略時)", () => {
    const state = stateWith(buffer("foo", "foo"), "s/foo/bar/", 1);
    const result = runExCommand(state);
    expect(result.buffer.lines).toEqual(["foo", "bar"]);
  });

  it("置換によってundoスタックが積まれる", () => {
    const state = stateWith(buffer("foo"), "s/foo/bar/");
    const result = runExCommand(state);
    expect(result.undoStack).toEqual([buffer("foo")]);
  });

  it("BRE由来のメタ文字(\\(...\\))をグルーピングとして扱う", () => {
    const state = stateWith(buffer("2024-01-02"), String.raw`s/\(\d\+\)-\(\d\+\)-\(\d\+\)/\3\/\2\/\1/`);
    const result = runExCommand(state);
    expect(result.buffer.lines).toEqual(["02/01/2024"]);
  });
});
