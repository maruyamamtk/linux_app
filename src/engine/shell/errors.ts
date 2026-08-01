/** シェル構文解析(字句解析・構文解析)中に検出された構文エラー。 */
export class ShellSyntaxError extends Error {
  /** エラーが発生した入力文字列中の位置(0始まりの文字インデックス)。 */
  readonly position: number;

  constructor(message: string, position: number) {
    super(`${message} (position: ${position})`);
    this.name = "ShellSyntaxError";
    this.position = position;
  }
}
