// シェル構文解析器(lexer/parser)が生成するASTのノード型定義。
// 対応範囲: 変数展開・クォート・コマンド置換($())・算術展開($(()))・パイプ(|)・
// リダイレクト(> >> < [n]>&m)・区切り(; && ||)・単語先頭の変数代入。
// 制御構造(if/for/while/case)・関数定義・バックグラウンド実行(&)・ヒアドキュメント(<<)は対象外。

/** ダブルクォート内・非クォートの単語を構成する部品。 */
export type WordPart =
  | TextPart
  | SingleQuotedPart
  | ParameterExpansionPart
  | CommandSubstitutionPart
  | ArithmeticExpansionPart;

/** クォートなし・エスケープ解決済みのリテラル文字列。 */
export interface TextPart {
  type: "Text";
  value: string;
}

/** シングルクォートで囲まれた、展開を一切行わないリテラル文字列。 */
export interface SingleQuotedPart {
  type: "SingleQuoted";
  value: string;
}

/**
 * パラメータ展開。`$name` `${name}` `${name:-word}` 等。
 * - `length`: `${#name}` (長さ取得)の場合true
 * - `operator`/`word`: `${name:-default}` 等の演算子付き展開の場合に設定
 */
export interface ParameterExpansionPart {
  type: "ParameterExpansion";
  name: string;
  length?: boolean;
  operator?: ":-" | ":=" | ":?" | ":+" | "-" | "=" | "?" | "+";
  word?: Word;
}

/** コマンド置換。`$(cmd)` および `` `cmd` `` の両方をこの形で表現する。 */
export interface CommandSubstitutionPart {
  type: "CommandSubstitution";
  script: Script;
}

/**
 * 算術展開 `$((expr))`。
 * 式自体の評価は本パーサのスコープ外のため、生テキストのまま保持する。
 */
export interface ArithmeticExpansionPart {
  type: "ArithmeticExpansion";
  expression: string;
}

/** ダブルクォートまたは非クォートの部品列からなる単語。 */
export interface Word {
  type: "Word";
  parts: WordPart[];
}

/** コマンド先頭の `NAME=value` 形式の変数代入。 */
export interface Assignment {
  type: "Assignment";
  name: string;
  value: Word;
}

export type RedirectTarget =
  | { kind: "word"; word: Word }
  | { kind: "fd"; fd: number };

/**
 * リダイレクト。`fd` はリダイレクト元のファイルディスクリプタ番号
 * (`>` `>>` はデフォルト1、`<` はデフォルト0、明示指定時は `2>` のように前置された数値)。
 * `dup` が true の場合 `N>&M` / `N<&M` 形式で、`target` は `{ kind: "fd" }` になる。
 */
export interface Redirect {
  type: "Redirect";
  fd: number;
  direction: "in" | "out";
  append: boolean;
  dup: boolean;
  target: RedirectTarget;
}

/** 単純コマンド(変数代入・コマンド名・引数・リダイレクトの並び)。 */
export interface SimpleCommand {
  type: "SimpleCommand";
  assignments: Assignment[];
  words: Word[];
  redirects: Redirect[];
}

/** `|` で連結された単純コマンドの列。 */
export interface Pipeline {
  type: "Pipeline";
  commands: SimpleCommand[];
}

export type LogicalOperator = "&&" | "||";

/** `&&` `||` で連結されたパイプラインの列。 */
export interface AndOrList {
  type: "AndOrList";
  pipelines: Pipeline[];
  /** `pipelines[i]` と `pipelines[i+1]` を結ぶ演算子。長さは `pipelines.length - 1`。 */
  operators: LogicalOperator[];
}

export type ScriptItemSeparator = ";" | "\n";

/** `;` または改行で区切られたトップレベルの1文。 */
export interface ScriptItem {
  andOr: AndOrList;
  /** この文の直後の区切り文字。スクリプト末尾で区切りが無い場合はundefined。 */
  separator?: ScriptItemSeparator;
}

/** パース結果のスクリプト全体(コマンド置換の中身も再帰的にこの形になる)。 */
export interface Script {
  type: "Script";
  body: ScriptItem[];
}
