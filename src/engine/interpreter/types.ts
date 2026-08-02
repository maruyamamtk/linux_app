import type { CommandContext } from "../commands";
import type { Script } from "../shell";

/**
 * スクリプト実行中に共有される状態。
 * `runSubshell` はコマンド置換 `$(...)` の中身を実行するためのコールバックで、
 * expand.ts から interpreter.ts への循環importを避けるため、実装(interpreter.ts)側から注入する。
 * コマンド置換はサブシェルの中で実行されるため、呼び出し元の `cwd`/`env` への変更は
 * 呼び出し元に影響しない(VFSの実体は共有するため、ファイルの読み書きは反映される)。
 */
export interface ShellState {
  context: CommandContext;
  /** 直前に実行したパイプラインの終了ステータス(`$?` の展開に使う)。 */
  lastExitCode: number;
  runSubshell: (script: Script) => { stdout: string; stderr: string; exitCode: number };
}
