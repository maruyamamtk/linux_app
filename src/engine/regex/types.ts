/**
 * 正規表現エンジンのAST型定義。
 * BRE(基本正規表現)/ERE(拡張正規表現)の両方を、同一のノード種別の組み合わせで表現する。
 * BREでは `group` `alternation` `plus` `question` `repeat` は生成されない
 * (grep -Eなど拡張構文を要求するコマンドのみがこれらを生成する)。
 */
export type RegexNode =
  | { type: "literal"; char: string }
  | { type: "any" }
  | { type: "charClass"; negate: boolean; chars: Set<string>; ranges: [string, string][] }
  | { type: "concat"; nodes: RegexNode[] }
  | { type: "alternation"; branches: RegexNode[] }
  | { type: "group"; node: RegexNode }
  | { type: "star"; node: RegexNode }
  | { type: "plus"; node: RegexNode }
  | { type: "question"; node: RegexNode }
  | { type: "repeat"; node: RegexNode; min: number; max: number | null }
  | { type: "startAnchor" }
  | { type: "endAnchor" };

/** どちらの正規表現構文として解釈するか。BRE=基本正規表現、ERE=拡張正規表現(`-E`)。 */
export type RegexSyntax = "basic" | "extended";

export interface CompileRegexOptions {
  /** `true` の場合ERE、`false`(既定)の場合BREとして解釈する。 */
  extended?: boolean;
  /** 大文字小文字を区別しない(`grep -i` 相当)。 */
  ignoreCase?: boolean;
}

export interface RegexMatch {
  /** マッチ開始位置(0-based)。 */
  start: number;
  /** マッチ終了位置(exclusive)。 */
  end: number;
  /** マッチした部分文字列。 */
  text: string;
}

export interface CompiledPattern {
  /** `input` 内のどこかにマッチする部分があれば `true`。 */
  test(input: string): boolean;
  /** `fromIndex` 以降で最初に見つかる(最左)マッチを返す。見つからなければ `null`。 */
  exec(input: string, fromIndex?: number): RegexMatch | null;
}
