import { awkCommand } from "./awk";
import {
  bunzip2Command,
  bzip2Command,
  gunzipCommand,
  gzipCommand,
  tarCommand,
  unzipCommand,
  zipCommand,
} from "./archive";
import {
  catCommand,
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
import { chmodCommand, suCommand, sudoCommand } from "./permissions";
import { bgCommand, fgCommand, jobsCommand, killCommand, psCommand } from "./process";
import { gitCommand } from "./git";
import { aptCommand, dnfCommand } from "./packageManager";
import { grepCommand } from "./grep";
import { colonCommand, echoCommand, falseCommand, trueCommand } from "./shellBuiltins";
import { sedCommand } from "./sed";
import { findCommand, helpCommand, locateCommand, manCommand, whichCommand } from "./search";
import { sshCommand } from "./ssh";
import { bracketCommand, testCommand } from "./test";
import {
  cutCommand,
  diffCommand,
  headCommand,
  sortCommand,
  tailCommand,
  trCommand,
  uniqCommand,
  wcCommand,
} from "./textProc";
import type { CommandContext, CommandHandler, CommandResult } from "./types";
import { xargsCommand } from "./xargs";

/**
 * コマンド名 → 実装関数のレジストリ。要件定義書4章のCh4-6・Ch9-10・Ch11-12・Ch14・Ch17該当コマンド群。
 */
export const commandRegistry: Readonly<Record<string, CommandHandler>> = {
  pwd: pwdCommand,
  cd: cdCommand,
  ls: lsCommand,
  cat: catCommand,
  mkdir: mkdirCommand,
  touch: touchCommand,
  rm: rmCommand,
  rmdir: rmdirCommand,
  cp: cpCommand,
  mv: mvCommand,
  ln: lnCommand,
  find: findCommand,
  locate: locateCommand,
  grep: grepCommand,
  which: whichCommand,
  man: manCommand,
  help: helpCommand,
  chmod: chmodCommand,
  su: suCommand,
  sudo: sudoCommand,
  ps: psCommand,
  jobs: jobsCommand,
  fg: fgCommand,
  bg: bgCommand,
  kill: killCommand,
  wc: wcCommand,
  sort: sortCommand,
  uniq: uniqCommand,
  cut: cutCommand,
  tr: trCommand,
  head: headCommand,
  tail: tailCommand,
  diff: diffCommand,
  sed: sedCommand,
  awk: awkCommand,
  test: testCommand,
  "[": bracketCommand,
  echo: echoCommand,
  true: trueCommand,
  false: falseCommand,
  ":": colonCommand,
  xargs: xargsCommand,
  tar: tarCommand,
  gzip: gzipCommand,
  gunzip: gunzipCommand,
  bzip2: bzip2Command,
  bunzip2: bunzip2Command,
  zip: zipCommand,
  unzip: unzipCommand,
  git: gitCommand,
  dnf: dnfCommand,
  apt: aptCommand,
  ssh: sshCommand,
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
