import { describe, expect, it } from "vitest";

import { isMotionKey, resolveMotion } from "./motions";
import type { VimBuffer } from "./types";

function buffer(...lines: string[]): VimBuffer {
  return { lines };
}

describe("isMotionKey", () => {
  it("対応モーションキーを判定する", () => {
    expect(isMotionKey("w")).toBe(true);
    expect(isMotionKey("gg")).toBe(true);
    expect(isMotionKey("f")).toBe(false);
    expect(isMotionKey("%")).toBe(false);
  });
});

describe("resolveMotion: h/l/0/$", () => {
  it("h は列0でクランプされる。l はオペレータ用途(dl等)のため行の長さまで進める(ノーマルモードでの表示上のクランプは呼び出し側の責務)", () => {
    const buf = buffer("abc");
    expect(resolveMotion("l", buf, { line: 0, col: 2 }, null)?.cursor).toEqual({ line: 0, col: 3 });
    expect(resolveMotion("h", buf, { line: 0, col: 0 }, null)?.cursor).toEqual({ line: 0, col: 0 });
  });

  it("$ は行末(len-1)へ、kindはinclusive", () => {
    const result = resolveMotion("$", buffer("abcdef"), { line: 0, col: 0 }, null);
    expect(result).toEqual({ cursor: { line: 0, col: 5 }, kind: "inclusive" });
  });

  it("0 は行頭へ、kindはexclusive", () => {
    const result = resolveMotion("0", buffer("abcdef"), { line: 0, col: 4 }, null);
    expect(result).toEqual({ cursor: { line: 0, col: 0 }, kind: "exclusive" });
  });
});

describe("resolveMotion: gg/G", () => {
  const buf = buffer("a", "b", "c", "d");

  it("count未指定のGは最終行、ggは先頭行", () => {
    expect(resolveMotion("G", buf, { line: 0, col: 0 }, null)?.cursor.line).toBe(3);
    expect(resolveMotion("gg", buf, { line: 3, col: 0 }, null)?.cursor.line).toBe(0);
  });

  it("count指定時は{count}行目(1-indexed)へ", () => {
    expect(resolveMotion("G", buf, { line: 0, col: 0 }, 2)?.cursor.line).toBe(1);
    expect(resolveMotion("gg", buf, { line: 3, col: 0 }, 3)?.cursor.line).toBe(2);
  });

  it("両者ともlinewise", () => {
    expect(resolveMotion("G", buf, { line: 0, col: 0 }, null)?.kind).toBe("linewise");
    expect(resolveMotion("gg", buf, { line: 0, col: 0 }, null)?.kind).toBe("linewise");
  });
});

describe("resolveMotion: w/b/e", () => {
  it("w は次の単語の先頭へ進む(exclusive)", () => {
    const buf = buffer("foo bar baz");
    const r1 = resolveMotion("w", buf, { line: 0, col: 0 }, null);
    expect(r1).toEqual({ cursor: { line: 0, col: 4 }, kind: "exclusive" });
  });

  it("w は行末で次行の先頭へ進む", () => {
    const buf = buffer("foo", "bar");
    const r = resolveMotion("w", buf, { line: 0, col: 0 }, null);
    expect(r?.cursor).toEqual({ line: 1, col: 0 });
  });

  it("w は句読点も1単語として扱う", () => {
    const buf = buffer("foo, bar");
    const r = resolveMotion("w", buf, { line: 0, col: 0 }, null);
    expect(r?.cursor).toEqual({ line: 0, col: 3 }); // "," の開始位置
  });

  it("b は前の単語の先頭へ戻る(exclusive)", () => {
    const buf = buffer("foo bar baz");
    const r = resolveMotion("b", buf, { line: 0, col: 8 }, null);
    expect(r?.cursor).toEqual({ line: 0, col: 4 });
  });

  it("e は現在/次の単語の末尾へ進む(inclusive)", () => {
    const buf = buffer("foo bar");
    const r = resolveMotion("e", buf, { line: 0, col: 0 }, null);
    expect(r).toEqual({ cursor: { line: 0, col: 2 }, kind: "inclusive" });
  });

  it("count付きのw/b/eは複数回移動する", () => {
    const buf = buffer("a b c d");
    expect(resolveMotion("w", buf, { line: 0, col: 0 }, 2)?.cursor).toEqual({ line: 0, col: 4 });
  });
});

describe("resolveMotion: 未対応キー", () => {
  it("未対応キーはnullを返す", () => {
    expect(resolveMotion("f", buffer("abc"), { line: 0, col: 0 }, null)).toBeNull();
  });
});
