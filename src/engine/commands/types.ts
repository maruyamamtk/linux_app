import type { VfsSnapshot, VirtualFileSystem } from "../vfs";

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
 * `ssh`で仮想リモートホストへ接続中、`exit`でローカルへ復帰するために退避しておくローカル側の状態。
 */
export interface SshSavedSession {
  snapshot: VfsSnapshot;
  cwd: string;
  env: Record<string, string>;
}

/**
 * `ssh`/`exit`が読み書きする、ssh接続に関する状態(docs/requirements.md 付録行「仮想リモートホストへの
 * ssh切替」)。`remoteHost`が設定されている間は接続中で、`exit`はスクリプト全体を終了させる通常の
 * 組み込みとしてではなく、ローカルセッションへ復帰する動作に切り替わる(simpleCommand.ts参照)。
 */
export interface SshState {
  /** 接続中の仮想リモートホストのプロンプト表示名(未接続時はundefined)。 */
  remoteHost?: string;
  /** 接続中のみ設定される、`exit`で復帰するためのローカル側の退避状態。 */
  saved?: SshSavedSession;
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
  /** パイプ(`|`)やリダイレクト(`<`)で渡された標準入力。未指定時は入力が無いことを表す。 */
  stdin?: string;
  ssh: SshState;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type CommandHandler = (args: string[], context: CommandContext) => CommandResult;
