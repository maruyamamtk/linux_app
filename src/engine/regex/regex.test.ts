import { describe, expect, it } from "vitest";

import { compileRegex, RegexSyntaxError } from "./index";

describe("compileRegex - basic regular expression (BRE)", () => {
  it("matches plain literal text anywhere in the input", () => {
    const re = compileRegex("cat");
    expect(re.test("concatenate")).toBe(true);
    expect(re.test("dog")).toBe(false);
  });

  it("matches '.' as any single character", () => {
    const re = compileRegex("c.t");
    expect(re.test("cat")).toBe(true);
    expect(re.test("cut")).toBe(true);
    expect(re.test("ct")).toBe(false);
  });

  it("supports character classes and negation", () => {
    expect(compileRegex("[abc]").test("xbz")).toBe(true);
    expect(compileRegex("[abc]").test("xyz")).toBe(false);
    expect(compileRegex("[^abc]").test("a")).toBe(false);
    expect(compileRegex("[^abc]").test("ax")).toBe(true);
  });

  it("supports ranges inside character classes", () => {
    const re = compileRegex("[a-c]");
    expect(re.test("b")).toBe(true);
    expect(re.test("d")).toBe(false);
  });

  it("treats a leading ']' inside a class as a literal member", () => {
    const re = compileRegex("[]a]");
    expect(re.test("]")).toBe(true);
    expect(re.test("a")).toBe(true);
    expect(re.test("b")).toBe(false);
  });

  it("anchors '^' and '$' only at the start/end of the whole pattern", () => {
    expect(compileRegex("^abc").test("abcdef")).toBe(true);
    expect(compileRegex("^abc").test("xabc")).toBe(false);
    expect(compileRegex("abc$").test("xabc")).toBe(true);
    expect(compileRegex("abc$").test("abcx")).toBe(false);
    expect(compileRegex("^abc$").test("abc")).toBe(true);
    expect(compileRegex("^abc$").test("abcd")).toBe(false);
  });

  it("treats '$' as a literal character when not at the end of the pattern", () => {
    const re = compileRegex("a$b");
    expect(re.test("a$b")).toBe(true);
    expect(re.test("ab")).toBe(false);
  });

  it("applies '*' as zero-or-more repetition of the preceding atom", () => {
    const re = compileRegex("ab*c");
    expect(re.test("ac")).toBe(true);
    expect(re.test("abc")).toBe(true);
    expect(re.test("abbbbc")).toBe(true);
    expect(re.test("abx")).toBe(false);
  });

  it("treats a leading '*' as a literal character", () => {
    const re = compileRegex("*abc");
    expect(re.test("*abc")).toBe(true);
  });

  it("treats extended-only metacharacters as literals in BRE", () => {
    const re = compileRegex("a+b?c(d)|e");
    expect(re.test("a+b?c(d)|e")).toBe(true);
  });

  it("supports escaping metacharacters with a backslash", () => {
    const re = compileRegex("a\\.b\\*c");
    expect(re.test("a.b*c")).toBe(true);
    expect(re.test("axbyc")).toBe(false);
  });

  it("is case sensitive by default and case-insensitive with the option", () => {
    expect(compileRegex("Cat").test("cat")).toBe(false);
    expect(compileRegex("Cat", { ignoreCase: true }).test("cat")).toBe(true);
  });
});

describe("compileRegex - extended regular expression (ERE)", () => {
  it("supports '+' one-or-more", () => {
    const re = compileRegex("ab+c", { extended: true });
    expect(re.test("ac")).toBe(false);
    expect(re.test("abc")).toBe(true);
    expect(re.test("abbbc")).toBe(true);
  });

  it("supports '?' zero-or-one", () => {
    const re = compileRegex("ab?c", { extended: true });
    expect(re.test("ac")).toBe(true);
    expect(re.test("abc")).toBe(true);
    expect(re.test("abbc")).toBe(false);
  });

  it("supports bounded intervals '{m,n}'", () => {
    const re = compileRegex("ab{2,3}c", { extended: true });
    expect(re.test("abc")).toBe(false);
    expect(re.test("abbc")).toBe(true);
    expect(re.test("abbbc")).toBe(true);
    expect(re.test("abbbbc")).toBe(false);
  });

  it("supports open-ended intervals '{m,}'", () => {
    const re = compileRegex("ab{2,}c", { extended: true });
    expect(re.test("abc")).toBe(false);
    expect(re.test("abbc")).toBe(true);
    expect(re.test("abbbbbc")).toBe(true);
  });

  it("supports exact intervals '{m}'", () => {
    const re = compileRegex("ab{2}c", { extended: true });
    expect(re.test("abc")).toBe(false);
    expect(re.test("abbc")).toBe(true);
    expect(re.test("abbbc")).toBe(false);
  });

  it("supports grouping with '()'", () => {
    const re = compileRegex("a(bc)+d", { extended: true });
    expect(re.test("ad")).toBe(false);
    expect(re.test("abcd")).toBe(true);
    expect(re.test("abcbcd")).toBe(true);
  });

  it("supports alternation with '|'", () => {
    const re = compileRegex("cat|dog", { extended: true });
    expect(re.test("I have a cat")).toBe(true);
    expect(re.test("I have a dog")).toBe(true);
    expect(re.test("I have a fish")).toBe(false);
  });

  it("supports alternation scoped by grouping", () => {
    const re = compileRegex("gr(a|e)y", { extended: true });
    expect(re.test("gray")).toBe(true);
    expect(re.test("grey")).toBe(true);
    expect(re.test("groy")).toBe(false);
  });

  it("throws a RegexSyntaxError for an unmatched group", () => {
    expect(() => compileRegex("a(bc", { extended: true })).toThrow(RegexSyntaxError);
  });
});

describe("compileRegex#exec", () => {
  it("returns the leftmost match position and matched text", () => {
    const re = compileRegex("b+", { extended: true });
    const match = re.exec("aabbbcc");
    expect(match).toEqual({ start: 2, end: 5, text: "bbb" });
  });

  it("returns null when there is no match", () => {
    expect(compileRegex("z").exec("abc")).toBeNull();
  });

  it("supports searching from a given offset, useful for repeated/global matching", () => {
    const re = compileRegex("a", { extended: true });
    const first = re.exec("banana");
    expect(first).toEqual({ start: 1, end: 2, text: "a" });
    const second = re.exec("banana", first!.end);
    expect(second).toEqual({ start: 3, end: 4, text: "a" });
  });
});
