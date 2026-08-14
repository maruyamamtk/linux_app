export class GitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitError";
  }
}

/**
 * docs/git-simulator-design.md 6章の方針: 未対応のサブコマンド・オプションはサイレントに
 * 無視せず、エラー(終了ステータス非0)を返す。
 */
export class GitUnsupportedCommandError extends GitError {
  constructor(subcommand: string) {
    super(`'${subcommand}' is not a supported command in this simulator`);
    this.name = "GitUnsupportedCommandError";
  }
}
