import type { GitObject, GitTreeEntry } from "./types";

/**
 * React Native(Hermes)には`crypto`モジュールが無く、暗号ライブラリの追加検証コストを
 * 避けるため、暗号学的ハッシュ関数(SHA-1等)には依存しない(3.2節)。同じ内容から
 * 同じハッシュが決定的に得られれば十分であり、衝突耐性は不要という判断による。
 */
function fnv1a(input: string, seed: number): number {
  let hash = seed;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function normalizeEntries(entries: GitTreeEntry[]): GitTreeEntry[] {
  return [...entries].sort((a, b) => a.name.localeCompare(b.name));
}

/** ハッシュ計算に使う正規化JSON文字列(キー順を固定)。実時刻は含めない(8章)。 */
function normalize(object: GitObject): string {
  switch (object.type) {
    case "blob":
      return JSON.stringify({ type: "blob", content: object.content });
    case "tree":
      return JSON.stringify({ type: "tree", entries: normalizeEntries(object.entries) });
    case "commit":
      return JSON.stringify({
        type: "commit",
        tree: object.tree,
        parents: object.parents,
        author: object.author,
        message: object.message,
        sequence: object.sequence,
      });
  }
}

/**
 * `object`から決定的な40桁16進文字列のハッシュを計算する(実Gitと同じ見た目にするため、
 * 値そのものが一致する必要はない)。FNV-1a(32bit)を繰り返しチェイン適用して桁数を稼ぐ。
 */
export function hashObject(object: GitObject): string {
  const normalized = normalize(object);
  let hex = "";
  let seed = 0x811c9dc5;
  while (hex.length < 40) {
    seed = fnv1a(normalized + hex, seed);
    hex += seed.toString(16).padStart(8, "0");
  }
  return hex.slice(0, 40);
}
