/** 実行時(展開・算術評価)エラー。構文は正しいが実行できない入力に対して投げる。 */
export class ShellRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShellRuntimeError";
  }
}
