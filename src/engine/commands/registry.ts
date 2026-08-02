import {
  cdCommand,
  cpCommand,
  lnCommand,
  lsCommand,
  mkdirCommand,
  mvCommand,
  pwdCommand,
  rmCommand,
  rmdirCommand,
  touchCommand,
} from "./fileOps";
import { findCommand, helpCommand, locateCommand, manCommand, whichCommand } from "./search";
import type { CommandContext, CommandHandler, CommandResult } from "./types";

/** コマンド名 → 実装関数のレジストリ。要件定義書4章のCh4-6該当コマンド群。 */
export const commandRegistry: Readonly<Record<string, CommandHandler>> = {
  pwd: pwdCommand,
  cd: cdCommand,
  ls: lsCommand,
  mkdir: mkdirCommand,
  touch: touchCommand,
  rm: rmCommand,
  rmdir: rmdirCommand,
  cp: cpCommand,
  mv: mvCommand,
  ln: lnCommand,
  find: findCommand,
  locate: locateCommand,
  which: whichCommand,
  man: manCommand,
  help: helpCommand,
};

export function resolveCommand(name: string): CommandHandler | undefined {
  return commandRegistry[name];
}

export function isKnownCommand(name: string): boolean {
  return name in commandRegistry;
}

/**
 * コマンド名から実装関数を引いて実行する。未知のコマンドはシェルの
 * "command not found"(終了ステータス127)を模した結果を返す。
 * 実装関数が想定外の例外を投げた場合も、呼び出し元(将来のインタプリタ)を
 * 巻き込まないようにここで捕捉しエラー結果に変換する。
 */
export function executeCommand(name: string, args: string[], context: CommandContext): CommandResult {
  const handler = resolveCommand(name);
  if (!handler) {
    return { stdout: "", stderr: `${name}: command not found`, exitCode: 127 };
  }

  try {
    return handler(args, context);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { stdout: "", stderr: `${name}: ${message}`, exitCode: 1 };
  }
}
