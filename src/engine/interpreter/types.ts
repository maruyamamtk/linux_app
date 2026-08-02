import type { CommandContext, CommandResult } from "../commands";
import type { FunctionDefinition, Script, ScriptItem } from "../shell";

/** `local` で退避した変数の元の値。`undefined` は「元は未設定だった」ことを表す。 */
export type LocalFrame = Map<string, string | undefined>;

/**
 * スクリプト実行中に共有される状態。
 * `runSubshell` はコマンド置換 `$(...)` の中身を実行するためのコールバックで、
 * `runCompoundList` はシェル関数呼び出し時に関数本体を実行するためのコールバックで、
 * どちらも expand.ts / simpleCommand.ts から interpreter.ts への循環importを避けるため、
 * 実装(interpreter.ts)側から注入する。
 * コマンド置換はサブシェルの中で実行されるため、呼び出し元の `cwd`/`env` への変更は
 * 呼び出し元に影響しない(VFSの実体は共有するため、ファイルの読み書きは反映される)。
 */
export interface ShellState {
  context: CommandContext;
  /** 直前に実行したパイプラインの終了ステータス(`$?` の展開に使う)。 */
  lastExitCode: number;
  runSubshell: (script: Script) => { stdout: string; stderr: string; exitCode: number };
  runCompoundList: (items: ScriptItem[]) => CommandResult;
  /** 定義済みのシェル関数(関数名 → 定義)。 */
  functions: Record<string, FunctionDefinition>;
  /** 現在のスコープの位置パラメータ(`$1` `$#` `$@` `$*` の展開に使う)。関数呼び出し中はその引数に置き換わる。 */
  positionalParams: string[];
  /** `local` 宣言のスタック。関数呼び出しごとに1フレーム積み、復帰時に元の値へ戻す。 */
  localFrames: LocalFrame[];
  /** 現在のシェル関数呼び出しのネスト段数(再帰の上限判定・`local`/`return`が関数外かどうかの判定に使う)。 */
  callDepth: number;
  /** `return` が実行された際に設定され、関数呼び出し元まで巻き戻る間の各実行ループを早期終了させる。 */
  returning?: { exitCode: number };
}
