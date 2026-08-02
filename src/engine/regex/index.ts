import { matchAt } from "./matcher";
import { parsePattern } from "./parser";
import type { CompiledPattern, CompileRegexOptions, RegexMatch } from "./types";

export { RegexSyntaxError } from "./errors";
export type { CompiledPattern, CompileRegexOptions, RegexMatch, RegexNode, RegexSyntax } from "./types";

/**
 * 正規表現パターンをコンパイルする。`grep` に加え、`sed`/`awk` など他コマンドからも
 * 共通利用できるよう、シェルコマンドに依存しない独立モジュールとして実装している。
 *
 * @param pattern BRE(既定)またはERE(`options.extended`)の正規表現文字列
 * @param options.extended `true` で拡張正規表現(`+ ? {m,n} () |`)を有効化する
 * @param options.ignoreCase `true` で大文字小文字を区別しない
 */
export function compileRegex(pattern: string, options: CompileRegexOptions = {}): CompiledPattern {
  const { extended = false, ignoreCase = false } = options;
  const ast = parsePattern(pattern, extended);

  return {
    test(input: string): boolean {
      for (let start = 0; start <= input.length; start += 1) {
        if (matchAt(ast, input, start, ignoreCase) !== null) return true;
      }
      return false;
    },
    exec(input: string, fromIndex = 0): RegexMatch | null {
      for (let start = fromIndex; start <= input.length; start += 1) {
        const end = matchAt(ast, input, start, ignoreCase);
        if (end !== null) return { start, end, text: input.slice(start, end) };
      }
      return null;
    },
  };
}
