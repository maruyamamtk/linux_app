/**
 * シェル構文解析器が生成するAST(抽象構文木)の型定義。
 *
 * 対応範囲(要件定義書3章3節): 変数展開・クォート・コマンド置換 `$()`・算術展開 `$(())`・
 * パイプ `|`・リダイレクト・`;` `&&` `||`。
 * if/for/case/while等の制御構造、関数定義、バックグラウンド実行 `&`、ヒアドキュメント `<<` は
 * 本パーサのスコープ外(別Issueで対応)。
 */

/** 単語(コマンド名・引数)を構成する断片。トップレベルではクォートされていない断片として並ぶ。 */
export type WordPart =
  | LiteralPart
  | SingleQuotedPart
  | DoubleQuotedPart
  | VariablePart
  | CommandSubstitutionPart
  | ArithmeticExpansionPart;

/** クォートされていないリテラル文字列。 */
export interface LiteralPart {
  type: "Literal";
  value: string;
}

/** `'...'` シングルクォート。中身は一切展開されない生のリテラル。 */
export interface SingleQuotedPart {
  type: "SingleQuoted";
  value: string;
}

/**
 * `"..."` ダブルクォート。内部で変数展開・コマンド置換・算術展開は行われるが、
 * 単語分割・グロブ展開は抑止される(抑止の適用自体は実行系=インタプリタの責務)。
 */
export interface DoubleQuotedPart {
  type: "DoubleQuoted";
  parts: DoubleQuotedInnerPart[];
}

export type DoubleQuotedInnerPart =
  | LiteralPart
  | VariablePart
  | CommandSubstitutionPart
  | ArithmeticExpansionPart;

/**
 * `$name` / `${name}` / 位置パラメータ(`$1`等) / 特殊パラメータ(`$?` `$#` `$@` `$*` `$$` `$!` `$-`)。
 * `${name:-default}` のようなパラメータ展開演算子は、`braced: true` の場合に `name` へ生テキストの
 * ままとして保持する(演算子自体の意味解釈は実行系の責務。パーサは境界を正しく切り出すことに専念する)。
 */
export interface VariablePart {
  type: "Variable";
  name: string;
  braced: boolean;
}

/** `$(command)` または `` `command` ``。中身は再帰的にパースされたASTを持つ。 */
export interface CommandSubstitutionPart {
  type: "CommandSubstitution";
  command: Script;
  style: "dollar" | "backtick";
}

/** `$((expression))`。算術式自体の評価は行わず、式の生テキストを保持する(評価は実行系の責務)。 */
export interface ArithmeticExpansionPart {
  type: "ArithmeticExpansion";
  expression: string;
}

export interface Word {
  type: "Word";
  parts: WordPart[];
}

/** `NAME=value` の形式のコマンド先頭の変数代入。 */
export interface Assignment {
  type: "Assignment";
  name: string;
  value: Word;
}

export type RedirectOperator = ">" | ">>" | "<" | ">&" | "<&";

export type RedirectionTarget =
  | { type: "File"; word: Word }
  | { type: "FdDuplicate"; fd: number };

/** `[fd]> word` / `[fd]>> word` / `[fd]< word` / `[fd]>&fd` / `[fd]<&fd` 形式のリダイレクト。 */
export interface Redirection {
  type: "Redirection";
  /** 対象のファイルディスクリプタ。省略時は演算子に応じて `<` `<&` は0、それ以外は1。 */
  fd: number;
  operator: RedirectOperator;
  target: RedirectionTarget;
}

/** 単純コマンド: 先頭の変数代入・コマンド名+引数・リダイレクトの組み合わせ。 */
export interface SimpleCommand {
  type: "SimpleCommand";
  assignments: Assignment[];
  words: Word[];
  redirections: Redirection[];
}

/** `cmd1 | cmd2 | cmd3` のパイプライン。 */
export interface Pipeline {
  type: "Pipeline";
  commands: SimpleCommand[];
}

export type LogicalOperator = "&&" | "||";

/** `pipeline1 && pipeline2 || pipeline3` のように論理演算子で連結されたリスト。 */
export interface AndOrList {
  type: "AndOrList";
  pipelines: Pipeline[];
  /** `operators.length === pipelines.length - 1`。`operators[i]` は `pipelines[i]` と `pipelines[i+1]` を結ぶ。 */
  operators: LogicalOperator[];
}

/** `;` または改行で区切られたコマンドのリスト全体(スクリプト、またはコマンド置換の中身)。 */
export interface Script {
  type: "Script";
  commands: AndOrList[];
}
