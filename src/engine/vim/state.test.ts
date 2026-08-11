import { describe, expect, it } from "vitest";

import { applyKey, createInitialState } from "./state";
import type { VimState } from "./types";

function keys(state: VimState, input: string[]): VimState {
  return input.reduce((acc, key) => applyKey(acc, key), state);
}

function text(state: VimState): string {
  return state.buffer.lines.join("\n");
}

describe("createInitialState", () => {
  it("末尾改行付きのファイル内容を行配列のバッファに変換する", () => {
    const state = createInitialState("foo\nbar\n");
    expect(state.buffer.lines).toEqual(["foo", "bar"]);
    expect(state.mode).toBe("normal");
    expect(state.cursor).toEqual({ line: 0, col: 0 });
  });

  it("空文字列は1行・空文字列のバッファになる", () => {
    const state = createInitialState("");
    expect(state.buffer.lines).toEqual([""]);
  });
});

describe("モード遷移", () => {
  it("i でインサートモードへ入り、Escapeでノーマルモードへ戻る(カーソルは1つ左)", () => {
    let state = createInitialState("abc\n");
    state = applyKey(state, "i");
    expect(state.mode).toBe("insert");
    state = applyKey(state, "X");
    expect(text(state)).toBe("Xabc");
    expect(state.cursor).toEqual({ line: 0, col: 1 });
    state = applyKey(state, "Escape");
    expect(state.mode).toBe("normal");
    expect(state.cursor).toEqual({ line: 0, col: 0 });
  });

  it(": でコマンドラインモードへ入り、Enterでノーマルモードへ戻る", () => {
    let state = createInitialState("abc\n");
    state = applyKey(state, ":");
    expect(state.mode).toBe("cmdline");
    state = keys(state, ["w"]);
    expect(state.commandLine).toBe("w");
    state = applyKey(state, "Enter");
    expect(state.mode).toBe("normal");
    expect(state.commandLine).toBe("");
    expect(state.statusMessage).toEqual({ text: "書き込みました", isError: false });
  });

  it("cmdlineモードのEscapeは入力内容を破棄してnormalへ戻る", () => {
    let state = createInitialState("abc\n");
    state = keys(state, [":", "s", "Escape"]);
    expect(state.mode).toBe("normal");
    expect(state.commandLine).toBe("");
  });
});

describe("カーソル移動", () => {
  it("l/h で列移動、行末で止まる(改行位置には乗らない)", () => {
    let state = createInitialState("abc\n");
    state = keys(state, ["l", "l", "l", "l"]);
    expect(state.cursor).toEqual({ line: 0, col: 2 });
    state = applyKey(state, "h");
    expect(state.cursor).toEqual({ line: 0, col: 1 });
  });

  it("j/k で行移動し、短い行へ移動すると列がクランプされる(元の列は記憶しない簡略実装)", () => {
    let state = createInitialState("abcdef\nxy\n");
    state = keys(state, ["l", "l", "l", "l"]); // col=4
    state = applyKey(state, "j");
    expect(state.cursor).toEqual({ line: 1, col: 1 });
    state = applyKey(state, "k");
    expect(state.cursor).toEqual({ line: 0, col: 1 });
  });

  it("0 で行頭、$ で行末へ", () => {
    let state = createInitialState("abcdef\n");
    state = keys(state, ["l", "l", "$"]);
    expect(state.cursor).toEqual({ line: 0, col: 5 });
    state = applyKey(state, "0");
    expect(state.cursor).toEqual({ line: 0, col: 0 });
  });

  it("gg/G でバッファ先頭/最終行へ、{count}G で指定行へ", () => {
    let state = createInitialState("a\nb\nc\nd\n");
    state = applyKey(state, "G");
    expect(state.cursor.line).toBe(3);
    state = keys(state, ["g", "g"]);
    expect(state.cursor.line).toBe(0);
    state = keys(state, ["3", "G"]);
    expect(state.cursor.line).toBe(2);
  });

  it("w/b/e で単語移動する", () => {
    let state = createInitialState("foo bar baz\n");
    state = applyKey(state, "w");
    expect(state.cursor).toEqual({ line: 0, col: 4 });
    state = applyKey(state, "w");
    expect(state.cursor).toEqual({ line: 0, col: 8 });
    state = applyKey(state, "b");
    expect(state.cursor).toEqual({ line: 0, col: 4 });
    state = applyKey(state, "e");
    expect(state.cursor).toEqual({ line: 0, col: 6 });
  });

  it("未対応キーはstatusMessageにエラーを設定する", () => {
    const state = applyKey(createInitialState("abc\n"), "Z");
    expect(state.statusMessage).toEqual({ text: "未対応の操作です: Z", isError: true });
  });
});

describe("編集コマンド: dd/yy/p", () => {
  it("dd で現在行を削除し、p でカーソルの下に貼り付ける", () => {
    let state = createInitialState("one\ntwo\nthree\n");
    state = keys(state, ["j"]); // カーソルは2行目("two")
    state = keys(state, ["d", "d"]);
    expect(text(state)).toBe("one\nthree");
    expect(state.register).toEqual({ content: "two\n", linewise: true });
    state = applyKey(state, "p");
    expect(text(state)).toBe("one\nthree\ntwo");
  });

  it("yy でヤンクしてもバッファは変わらず、p で複製できる", () => {
    let state = createInitialState("one\ntwo\n");
    state = keys(state, ["y", "y"]);
    expect(text(state)).toBe("one\ntwo");
    expect(state.register).toEqual({ content: "one\n", linewise: true });
    state = applyKey(state, "p");
    expect(text(state)).toBe("one\none\ntwo");
  });

  it("P でカーソルの上に貼り付ける", () => {
    let state = createInitialState("one\ntwo\n");
    state = keys(state, ["y", "y", "j", "P"]);
    expect(text(state)).toBe("one\none\ntwo");
  });

  it("{count}dd で複数行削除する", () => {
    let state = createInitialState("one\ntwo\nthree\nfour\n");
    state = keys(state, ["2", "d", "d"]);
    expect(text(state)).toBe("three\nfour");
  });
});

describe("編集コマンド: 糖衣構文", () => {
  it("x はカーソル位置の1文字を削除しレジスタに入れる", () => {
    let state = createInitialState("abc\n");
    state = applyKey(state, "x");
    expect(text(state)).toBe("bc");
    expect(state.register).toEqual({ content: "a", linewise: false });
  });

  it("D は d$ の糖衣", () => {
    let state = createInitialState("abcdef\n");
    state = keys(state, ["l", "l", "D"]);
    expect(text(state)).toBe("ab");
  });

  it("Y は yy の糖衣", () => {
    let state = createInitialState("abc\n");
    state = applyKey(state, "Y");
    expect(state.register).toEqual({ content: "abc\n", linewise: true });
  });
});

describe("編集コマンド: オペレータ+モーション", () => {
  it("dw で単語を削除する", () => {
    let state = createInitialState("foo bar baz\n");
    state = keys(state, ["d", "w"]);
    expect(text(state)).toBe("bar baz");
  });

  it("d$ でカーソル位置から行末まで削除する", () => {
    let state = createInitialState("foobar\n");
    state = keys(state, ["l", "l", "d", "$"]);
    expect(text(state)).toBe("fo");
  });

  it("dG でカーソル行から最終行まで削除する", () => {
    let state = createInitialState("a\nb\nc\nd\n");
    state = keys(state, ["j", "d", "G"]);
    expect(text(state)).toBe("a");
  });

  it("cw は単語を削除してインサートモードに入る", () => {
    let state = createInitialState("foo bar\n");
    state = keys(state, ["c", "w"]);
    expect(state.mode).toBe("insert");
    expect(text(state)).toBe(" bar");
    state = keys(state, ["b", "a", "z", "Escape"]);
    expect(text(state)).toBe("baz bar");
  });

  it("2d3w のようにカウントを掛け合わせる(2*3=6語削除)", () => {
    let state = createInitialState("a b c d e f g\n");
    state = keys(state, ["2", "d", "3", "w"]);
    expect(text(state)).toBe("g");
  });
});

describe("undo/redo", () => {
  it("u で直前の編集を取り消し、Ctrl-r でやり直す", () => {
    let state = createInitialState("abc\n");
    state = applyKey(state, "x");
    expect(text(state)).toBe("bc");
    state = applyKey(state, "u");
    expect(text(state)).toBe("abc");
    state = applyKey(state, "Ctrl-r");
    expect(text(state)).toBe("bc");
  });

  it("何も編集していない状態でのuはエラーメッセージを出す", () => {
    const state = applyKey(createInitialState("abc\n"), "u");
    expect(state.statusMessage?.isError).toBe(true);
  });

  it("挿入モードの一連の入力は1回のundoでまとめて取り消される", () => {
    let state = createInitialState("abc\n");
    state = keys(state, ["i", "X", "Y", "Z", "Escape"]);
    expect(text(state)).toBe("XYZabc");
    state = applyKey(state, "u");
    expect(text(state)).toBe("abc");
  });
});

describe("exコマンド: 置換", () => {
  it(":s/old/new/ はカーソル行の最初の一致のみ置換する", () => {
    let state = createInitialState("foo foo\nbar\n");
    state = keys(state, [":", "s", "/", "f", "o", "o", "/", "b", "a", "z", "/", "Enter"]);
    expect(text(state)).toBe("baz foo\nbar");
  });

  it(":s/old/new/g はカーソル行の全ての一致を置換する", () => {
    let state = createInitialState("foo foo\nbar\n");
    state = keys(state, [":", "s", "/", "f", "o", "o", "/", "b", "a", "z", "/", "g", "Enter"]);
    expect(text(state)).toBe("baz baz\nbar");
  });

  it(":%s/old/new/g は全行が対象", () => {
    let state = createInitialState("foo\nfoo\nfoo\n");
    state = keys(state, [":", "%", "s", "/", "f", "o", "o", "/", "b", "a", "r", "/", "g", "Enter"]);
    expect(text(state)).toBe("bar\nbar\nbar");
  });

  it(":{n},{m}s/old/new/g は指定範囲のみ対象", () => {
    let state = createInitialState("foo\nfoo\nfoo\nfoo\n");
    state = keys(state, [
      ":",
      "2",
      ",",
      "3",
      "s",
      "/",
      "f",
      "o",
      "o",
      "/",
      "x",
      "/",
      "g",
      "Enter",
    ]);
    expect(text(state)).toBe("foo\nx\nx\nfoo");
  });

  it("一致が無い場合はエラーメッセージを表示しバッファを変更しない", () => {
    let state = createInitialState("abc\n");
    state = keys(state, [":", "s", "/", "z", "z", "z", "/", "w", "/", "Enter"]);
    expect(text(state)).toBe("abc");
    expect(state.statusMessage?.isError).toBe(true);
  });
});

describe("exコマンド: 行移動・:w/:q/:wq", () => {
  it(":{n} で指定行へ移動する", () => {
    let state = createInitialState("a\nb\nc\n");
    state = keys(state, [":", "3", "Enter"]);
    expect(state.cursor.line).toBe(2);
  });

  it(":w :q :wq はステータスメッセージを返す", () => {
    let state = createInitialState("abc\n");
    state = keys(state, [":", "q", "Enter"]);
    expect(state.statusMessage?.isError).toBe(false);
    state = keys(state, [":", "w", "q", "Enter"]);
    expect(state.statusMessage?.isError).toBe(false);
  });
});
