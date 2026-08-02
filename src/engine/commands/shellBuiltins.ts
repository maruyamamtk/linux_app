// シェルスクリプトの基本的な制御構造(if/for/while/case)・関数を書く上で不可欠な、
// ごく基本的なシェル組み込みコマンド。`echo`はメッセージ出力、`true`/`false`は
// 条件式の固定値、`:`(コロン)は何もしない no-op(`while true; do :; done`等の
// プレースホルダとして使う)。
import { ok } from "./errors";
import type { CommandHandler } from "./types";

/** `echo [-n] arg...`。`-n`で末尾の改行を抑制する(それ以外のオプション・エスケープ解釈は対象外)。 */
export const echoCommand: CommandHandler = (args) => {
  const suppressNewline = args[0] === "-n";
  const rest = suppressNewline ? args.slice(1) : args;
  const text = rest.join(" ");
  return ok(suppressNewline ? text : `${text}\n`);
};

export const trueCommand: CommandHandler = () => ok("");

export const falseCommand: CommandHandler = () => ({ stdout: "", stderr: "", exitCode: 1 });

/** `:`。何もせず常に成功する(引数は無視する)。 */
export const colonCommand: CommandHandler = () => ok("");
