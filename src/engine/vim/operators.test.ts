import { describe, expect, it } from "vitest";

import {
  applyLinewiseOnCurrentLine,
  applyOperatorMotion,
  deleteCharUnderCursor,
  deleteToEndOfLine,
  pasteAfter,
  pasteBefore,
  redo,
  undo,
  yankCurrentLines,
} from "./operators";
import { resolveMotion } from "./motions";
import type { VimBuffer, VimState } from "./types";
import { createEmptyPending } from "./types";

function buffer(...lines: string[]): VimBuffer {
  return { lines };
}

function baseState(buf: VimBuffer): VimState {
  return {
    mode: "normal",
    buffer: buf,
    cursor: { line: 0, col: 0 },
    register: { content: "", linewise: false },
    pending: createEmptyPending(),
    commandLine: "",
    statusMessage: null,
    undoStack: [],
    redoStack: [],
    keyLog: [],
  };
}

describe("applyOperatorMotion: charwise", () => {
  it("dw は次の単語の先頭までを削除する", () => {
    const buf = buffer("foo bar baz");
    const motion = resolveMotion("w", buf, { line: 0, col: 0 }, 1)!;
    const result = applyOperatorMotion(buf, { line: 0, col: 0 }, "d", motion);
    expect(result.buffer.lines).toEqual(["bar baz"]);
    expect(result.register).toEqual({ content: "foo ", linewise: false });
    expect(result.cursor).toEqual({ line: 0, col: 0 });
  });

  it("d$ は inclusive として行末まで削除する", () => {
    const buf = buffer("foobar");
    const motion = resolveMotion("$", buf, { line: 0, col: 2 }, null)!;
    const result = applyOperatorMotion(buf, { line: 0, col: 2 }, "d", motion);
    expect(result.buffer.lines).toEqual(["fo"]);
  });

  it("y は元のバッファを変更せずレジスタのみ更新する", () => {
    const buf = buffer("foo bar");
    const motion = resolveMotion("w", buf, { line: 0, col: 0 }, 1)!;
    const result = applyOperatorMotion(buf, { line: 0, col: 0 }, "y", motion);
    expect(result.buffer).toBe(buf);
    expect(result.register).toEqual({ content: "foo ", linewise: false });
  });
});

describe("applyOperatorMotion: linewise (dj/dk/dG/dgg)", () => {
  it("dG はカーソル行から最終行までを削除する", () => {
    const buf = buffer("a", "b", "c", "d");
    const motion = resolveMotion("G", buf, { line: 1, col: 0 }, null)!;
    const result = applyOperatorMotion(buf, { line: 1, col: 0 }, "d", motion);
    expect(result.buffer.lines).toEqual(["a"]);
    expect(result.register).toEqual({ content: "b\nc\nd\n", linewise: true });
  });

  it("全行を削除すると空バッファ([\"\"])になる", () => {
    const buf = buffer("a", "b");
    const motion = resolveMotion("G", buf, { line: 0, col: 0 }, null)!;
    const result = applyOperatorMotion(buf, { line: 0, col: 0 }, "d", motion);
    expect(result.buffer.lines).toEqual([""]);
  });
});

describe("applyLinewiseOnCurrentLine (dd/yy/cc)", () => {
  it("{count}行分を対象にする", () => {
    const buf = buffer("a", "b", "c", "d");
    const result = applyLinewiseOnCurrentLine(buf, { line: 0, col: 0 }, "d", 2);
    expect(result.buffer.lines).toEqual(["c", "d"]);
  });

  it("cc は対象行を1つの空行に置き換える", () => {
    const buf = buffer("a", "b", "c");
    const result = applyLinewiseOnCurrentLine(buf, { line: 0, col: 0 }, "c", 2);
    expect(result.buffer.lines).toEqual(["", "c"]);
  });
});

describe("x/D/Y", () => {
  it("x はcount文字を削除する", () => {
    const buf = buffer("abcdef");
    const result = deleteCharUnderCursor(buf, { line: 0, col: 1 }, 3);
    expect(result.buffer.lines).toEqual(["aef"]);
    expect(result.register).toEqual({ content: "bcd", linewise: false });
  });

  it("行末を超えるcountは行末までで止まる", () => {
    const buf = buffer("abc");
    const result = deleteCharUnderCursor(buf, { line: 0, col: 1 }, 10);
    expect(result.buffer.lines).toEqual(["a"]);
  });

  it("D は行末まで削除する", () => {
    const buf = buffer("abcdef");
    const result = deleteToEndOfLine(buf, { line: 0, col: 2 });
    expect(result.buffer.lines).toEqual(["ab"]);
  });

  it("Y はdd相当のレジスタ内容になる", () => {
    const buf = buffer("abc", "def");
    const result = yankCurrentLines(buf, { line: 0, col: 0 }, 1);
    expect(result.register).toEqual({ content: "abc\n", linewise: true });
    expect(result.buffer).toBe(buf);
  });
});

describe("paste (p/P)", () => {
  it("行単位レジスタは次行/前行に挿入される", () => {
    const buf = buffer("one", "two");
    const register = { content: "yanked\n", linewise: true };
    expect(pasteAfter(buf, { line: 0, col: 0 }, register).buffer.lines).toEqual(["one", "yanked", "two"]);
    expect(pasteBefore(buf, { line: 0, col: 0 }, register).buffer.lines).toEqual(["yanked", "one", "two"]);
  });

  it("文字単位レジスタはカーソルの後ろ/前に挿入される", () => {
    const buf = buffer("ac");
    const register = { content: "b", linewise: false };
    const after = pasteAfter(buf, { line: 0, col: 0 }, register);
    expect(after.buffer.lines).toEqual(["abc"]);
    const before = pasteBefore(buf, { line: 0, col: 1 }, register);
    expect(before.buffer.lines).toEqual(["abc"]);
  });

  it("空レジスタからの貼り付けは何もしない", () => {
    const buf = buffer("abc");
    const register = { content: "", linewise: false };
    const result = pasteAfter(buf, { line: 0, col: 0 }, register);
    expect(result.buffer).toBe(buf);
  });
});

describe("undo/redo", () => {
  it("undoStackが空ならエラーメッセージを返す", () => {
    const state = baseState(buffer("abc"));
    const result = undo(state);
    expect(result.statusMessage?.isError).toBe(true);
    expect(result.buffer).toBe(state.buffer);
  });

  it("undo/redoでバッファを行き来する", () => {
    let state = baseState(buffer("new"));
    state = { ...state, undoStack: [buffer("old")] };
    state = undo(state);
    expect(state.buffer.lines).toEqual(["old"]);
    expect(state.redoStack).toHaveLength(1);
    state = redo(state);
    expect(state.buffer.lines).toEqual(["new"]);
  });
});
