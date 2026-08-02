import type { VirtualFileSystem } from "../vfs";

/**
 * `ps`/`jobs`/`fg`/`bg`/`kill` が操作するモックのプロセス。実際にコマンドを
 * 実行するわけではなく、演習用に用意された固定のプロセス一覧をこのCommandContext上で
 * 状態変化(停止→再開、終了等)させることでジョブ制御コマンドの挙動を再現する。
 */
export interface MockProcess {
  pid: number;
  /** バックグラウンドジョブ(`jobs`の`%N`表記に対応)のみ持つ。フォアグラウンド化すると失われる。 */
  jobId?: number;
  command: string;
  status: "running" | "stopped";
  owner: string;
}

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
  processes: MockProcess[];
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
