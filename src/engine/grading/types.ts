import type { CommandResult, MockProcess } from "../commands";
import type { VfsDiffEntry, VfsSnapshot, VfsUser } from "../vfs";

/**
 * 標準出力/標準エラー出力の比較モード。「文字列完全一致」だけでは別解(教科書の模範解答とは
 * 違う書き方だが観測可能な効果が同じコマンド)を誤って不正解にしてしまうため、演習ごとに
 * どこまでの違いを許容するかを選べるようにする。
 */
export type TextComparisonMode =
  /** 加工せずそのまま比較する。 */
  | "exact"
  /** 末尾の改行の有無・個数の違いを無視して比較する(デフォルト)。 */
  | "trimTrailingNewline"
  /** 末尾の改行を無視した上で行単位に分割し、ソートしてから比較する(出力順序の違いを許容する)。 */
  | "ignoreLineOrder";

export interface GradeOptions {
  /** 標準出力の比較モード(デフォルト: "trimTrailingNewline")。 */
  stdoutMode?: TextComparisonMode;
  /** 標準エラー出力の比較モード(デフォルト: "trimTrailingNewline")。 */
  stderrMode?: TextComparisonMode;
  /** 終了ステータスを判定に含めるか(デフォルト: true)。 */
  compareExitCode?: boolean;
  /** 実行後のVFS状態(ファイル有無・内容・パーミッション)を判定に含めるか(デフォルト: true)。 */
  compareVfs?: boolean;
  /**
   * VFS状態の比較から除外するパス(前方一致)。演習の本題とは関係のない一時ファイル等、
   * 学習者側だけに生じる差分を無視したい場合に指定する。
   */
  ignoreVfsPaths?: string[];
}

export interface GradeInput {
  /** 演習の初期VFSスナップショット。学習者・模範解答それぞれに独立した複製を読み込んで実行する。 */
  snapshot: VfsSnapshot;
  user: VfsUser;
  cwd: string;
  env: Record<string, string>;
  /** モックのプロセス一覧(ps/jobs等を使う演習向け)。省略時は空配列。 */
  processes?: MockProcess[];
  /** 学習者が入力したコマンド、またはシェルスクリプト全文。 */
  userInput: string;
  /** 模範解答のコマンド、またはシェルスクリプト全文。 */
  referenceSolution: string;
  options?: GradeOptions;
}

export interface FieldComparison<T> {
  match: boolean;
  expected: T;
  actual: T;
}

export interface GradeResult {
  /** すべての比較対象(有効化されているもの)が一致した場合に true。 */
  passed: boolean;
  /** 学習者の入力を実行した生の結果。 */
  userResult: CommandResult;
  /** 模範解答を実行した生の結果。 */
  referenceResult: CommandResult;
  stdout: FieldComparison<string>;
  stderr: FieldComparison<string>;
  exitCode: FieldComparison<number>;
  /**
   * 模範解答実行後のVFSを基準(before)、学習者実行後のVFSを比較対象(after)として得た差分。
   * `compareVfs` が false の場合は常に空配列。空配列であればVFS状態は一致している。
   */
  vfsMismatches: VfsDiffEntry[];
}
