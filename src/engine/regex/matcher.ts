import type { RegexNode } from "./types";

/**
 * 継続渡しスタイル(CPS)によるバックトラッキング型マッチャ。
 * `cont` は「このノード以降のパターンが位置 `pos` からマッチできるか」を表す関数で、
 * マッチ成功時はその先の終了位置を、失敗時は `null` を返す。
 * `*`/`+`/`{m,n}` は貪欲(greedy)に最大回数を試した上で `cont` が失敗すれば
 * 1回ずつ手放して再試行する。
 */
type Continuation = (pos: number) => number | null;

function charEquals(a: string, b: string, ignoreCase: boolean): boolean {
  if (!ignoreCase) return a === b;
  return a.toLowerCase() === b.toLowerCase();
}

function charInClass(
  ch: string,
  node: Extract<RegexNode, { type: "charClass" }>,
  ignoreCase: boolean,
): boolean {
  const test = (candidate: string): boolean => {
    if (node.chars.has(candidate)) return true;
    for (const [from, to] of node.ranges) {
      if (candidate >= from && candidate <= to) return true;
    }
    return false;
  };

  let matched = test(ch);
  if (!matched && ignoreCase) {
    matched = test(ch.toLowerCase()) || test(ch.toUpperCase());
  }
  return node.negate ? !matched : matched;
}

function matchNode(
  node: RegexNode,
  input: string,
  pos: number,
  ignoreCase: boolean,
  cont: Continuation,
): number | null {
  switch (node.type) {
    case "literal":
      if (pos < input.length && charEquals(input[pos], node.char, ignoreCase)) return cont(pos + 1);
      return null;

    case "any":
      if (pos < input.length) return cont(pos + 1);
      return null;

    case "charClass":
      if (pos < input.length && charInClass(input[pos], node, ignoreCase)) return cont(pos + 1);
      return null;

    case "startAnchor":
      return pos === 0 ? cont(pos) : null;

    case "endAnchor":
      return pos === input.length ? cont(pos) : null;

    case "group":
      return matchNode(node.node, input, pos, ignoreCase, cont);

    case "concat":
      return matchConcat(node.nodes, 0, input, pos, ignoreCase, cont);

    case "alternation":
      for (const branch of node.branches) {
        const result = matchNode(branch, input, pos, ignoreCase, cont);
        if (result !== null) return result;
      }
      return null;

    case "star":
      return matchGreedyRepeat(node.node, 0, null, input, pos, ignoreCase, cont);

    case "plus":
      return matchGreedyRepeat(node.node, 1, null, input, pos, ignoreCase, cont);

    case "question":
      return matchGreedyRepeat(node.node, 0, 1, input, pos, ignoreCase, cont);

    case "repeat":
      return matchGreedyRepeat(node.node, node.min, node.max, input, pos, ignoreCase, cont);

    default: {
      const exhaustive: never = node;
      throw new Error(`Unhandled regex node: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function matchConcat(
  nodes: RegexNode[],
  index: number,
  input: string,
  pos: number,
  ignoreCase: boolean,
  cont: Continuation,
): number | null {
  if (index === nodes.length) return cont(pos);
  return matchNode(nodes[index], input, pos, ignoreCase, (nextPos) =>
    matchConcat(nodes, index + 1, input, nextPos, ignoreCase, cont),
  );
}

/**
 * `min`〜`max`回(`max === null` は無制限)の貪欲な繰り返しマッチ。
 * まず必須回数(`min`)を消費し、その後は「1回でも多く」を優先しつつ
 * `cont` が失敗した分だけ回数を手放して再試行する。
 * 空文字列にマッチするアトム(例: `()*`)による無限ループを防ぐため、
 * 繰り返し1回が位置を進めなかった場合はそれ以上の繰り返しを打ち切る。
 */
function matchGreedyRepeat(
  atom: RegexNode,
  min: number,
  max: number | null,
  input: string,
  startPos: number,
  ignoreCase: boolean,
  cont: Continuation,
): number | null {
  const matchFrom = (count: number, pos: number): number | null => {
    const canMatchMore = max === null || count < max;
    if (canMatchMore) {
      const result = matchNode(atom, input, pos, ignoreCase, (nextPos) => {
        if (nextPos === pos) return null; // 空文字マッチによる無限ループを回避
        return matchFrom(count + 1, nextPos);
      });
      if (result !== null) return result;
    }
    if (count < min) return null;
    return cont(pos);
  };

  return matchFrom(0, startPos);
}

/** `input` の位置 `start` から、貪欲マッチした場合の終了位置を返す(マッチしなければ `null`)。 */
export function matchAt(node: RegexNode, input: string, start: number, ignoreCase: boolean): number | null {
  const identity: Continuation = (pos) => pos;
  return matchNode(node, input, start, ignoreCase, identity);
}
