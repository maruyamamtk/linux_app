/** コマンドライン引数を解析した結果。 */
export interface ParsedArgs {
  /** 単独文字オプション(`-la` は "l","a" の2つ)・ロングオプション(`--recursive`)の集合。 */
  flags: Set<string>;
  /** オプション以外の引数(コマンド名の後に続くファイル名等)。 */
  positional: string[];
}

/**
 * `-rf` のような結合された単独文字オプション、`--recursive` のようなロングオプション、
 * `--` (以降を全て非オプション引数として扱う)に対応した簡易パーサ。
 * オプションの値(`-name pattern` 等)を取る形式はコマンドごとに個別で解析する。
 */
export function parseArgs(args: string[]): ParsedArgs {
  const flags = new Set<string>();
  const positional: string[] = [];
  let onlyPositional = false;

  for (const arg of args) {
    if (onlyPositional) {
      positional.push(arg);
      continue;
    }
    if (arg === "--") {
      onlyPositional = true;
      continue;
    }
    if (arg.startsWith("--") && arg.length > 2) {
      flags.add(arg.slice(2));
      continue;
    }
    if (arg.startsWith("-") && arg.length > 1) {
      for (const ch of arg.slice(1)) flags.add(ch);
      continue;
    }
    positional.push(arg);
  }

  return { flags, positional };
}
