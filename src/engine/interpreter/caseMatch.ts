// caseクラウズのパターンマッチング。シェルのグロブパターン(`*` `?` `[...]`)を
// 正規表現に変換して照合する。パターン・対象語ともに展開後の文字列として渡される想定のため、
// クォート由来かどうか(グロブ文字を無効化すべきか)は区別しない(本パーサはWordPart単位で
// クォート境界を保持していないため、簡略化した近似として扱う)。
const REGEX_SPECIAL_CHARS = /[.+^${}()|\\]/;

function globToRegExp(pattern: string): RegExp {
  let out = "";

  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];

    if (ch === "*") {
      out += ".*";
      continue;
    }
    if (ch === "?") {
      out += ".";
      continue;
    }
    if (ch === "[") {
      const close = pattern.indexOf("]", i + 2);
      if (close !== -1) {
        let body = pattern.slice(i + 1, close);
        if (body.startsWith("!")) body = `^${body.slice(1)}`;
        out += `[${body}]`;
        i = close;
        continue;
      }
    }

    out += REGEX_SPECIAL_CHARS.test(ch) ? `\\${ch}` : ch;
  }

  return new RegExp(`^${out}$`, "s");
}

export function matchesCasePattern(pattern: string, value: string): boolean {
  return globToRegExp(pattern).test(value);
}
