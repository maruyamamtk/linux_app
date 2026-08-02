import type { VirtualFileSystem } from "../vfs";

/**
 * コマンド実行間で共有される状態。
 * `cd` はカレントディレクトリを変更するために `cwd` を直接書き換える
 * (実際のシェルにおける組み込みコマンドと同様、子プロセスではなく
 * 呼び出し元のセッション状態そのものを変更する)。
 */
export interface CommandContext {
  vfs: VirtualFileSystem;
  cwd: string;
  env: Record<string, string>;
  /**
   * パイプ(`|`)で前段のコマンドから渡される標準入力。シェルインタプリタが
   * 未実装のため現状は常に未設定だが、`wc`/`sort`/`uniq`/`cut`/`tr`/`head` は
   * ファイル引数が無い場合にここを読む形で将来のパイプ対応に備える。
   */
  stdin?: string;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type CommandHandler = (args: string[], context: CommandContext) => CommandResult;
