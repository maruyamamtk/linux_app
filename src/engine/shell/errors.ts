export class ShellSyntaxError extends Error {
  /** エラーが発生した入力文字列中の0始まりオフセット。不明な場合はundefined。 */
  readonly position?: number;

  constructor(message: string, position?: number) {
    super(position !== undefined ? `${message} (position ${position})` : message);
    this.name = "ShellSyntaxError";
    this.position = position;
  }
}
