/** exコマンド(`:`以降の入力)のパース・実行時エラー。`VimState.statusMessage` に変換して表示する。 */
export class VimExCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VimExCommandError";
  }
}
