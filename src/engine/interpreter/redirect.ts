// リダイレクト(`>` `>>` `<` `2>` `2>&1` `<<`/`<<-` 等)の解決と適用。
// `/dev/null` の特殊挙動(書き込み破棄・読み込み常に空)はVFS層(vfs/virtualFileSystem.ts)で
// 実装済みのため、ここでは意識せず通常のファイルパスと同様に扱えばよい。
import type { Redirect } from "../shell";
import { normalizePath, VfsError, type VfsErrorCode, type VirtualFileSystem } from "../vfs";
import { expandWord } from "./expand";
import type { ShellState } from "./types";

export type ChannelTarget = { kind: "terminal" } | { kind: "file"; path: string; append: boolean };

export interface RedirectResolution {
  /** fd0(標準入力)がファイルにリダイレクトされていた場合、その内容。 */
  stdinOverride?: string;
  stdout: ChannelTarget;
  stderr: ChannelTarget;
  /** 入力リダイレクトのオープンに失敗した場合のエラーメッセージ(コマンドを実行せず中断する)。 */
  error?: string;
}

const REDIRECT_ERROR_MESSAGES: Partial<Record<VfsErrorCode, string>> = {
  ENOENT: "No such file or directory",
  EISDIR: "Is a directory",
  EACCES: "Permission denied",
  ENOTDIR: "Not a directory",
};

function formatRedirectError(path: string, caught: unknown): string {
  if (caught instanceof VfsError) {
    return `bash: ${path}: ${REDIRECT_ERROR_MESSAGES[caught.code] ?? caught.code}\n`;
  }
  throw caught;
}

/**
 * `SimpleCommand.redirects` を左から順に適用し、fd1(標準出力)・fd2(標準エラー出力)の
 * 最終的な行き先と、fd0(標準入力)がファイルに差し替えられていればその内容を求める。
 * `N>&M` / `N<&M` はその時点での fd M の行き先を fd N にコピーする(以降の fd M への
 * 再リダイレクトはfd Nに遡って影響しない、実シェルと同じスナップショット的挙動)。
 */
export function resolveRedirects(redirects: readonly Redirect[], state: ShellState): RedirectResolution {
  const table = new Map<number, ChannelTarget>([
    [1, { kind: "terminal" }],
    [2, { kind: "terminal" }],
  ]);
  let stdinOverride: string | undefined;
  let error: string | undefined;

  for (const redirect of redirects) {
    if (error) break;

    if (redirect.target.kind === "fd") {
      const source = table.get(redirect.target.fd) ?? { kind: "terminal" };
      table.set(redirect.fd, { ...source });
      continue;
    }

    if (redirect.target.kind === "heredoc") {
      const content = expandWord(redirect.target.word, state);
      if (redirect.fd === 0) stdinOverride = content;
      continue;
    }

    const path = normalizePath(expandWord(redirect.target.word, state), state.context.cwd);

    if (redirect.direction === "in") {
      table.set(redirect.fd, { kind: "file", path, append: false });
      if (redirect.fd === 0) {
        try {
          stdinOverride = state.context.vfs.readFile(path);
        } catch (caught) {
          error = formatRedirectError(path, caught);
        }
      }
      continue;
    }

    table.set(redirect.fd, { kind: "file", path, append: redirect.append });
  }

  return {
    stdinOverride,
    stdout: table.get(1) ?? { kind: "terminal" },
    stderr: table.get(2) ?? { kind: "terminal" },
    error,
  };
}

/**
 * コマンド実行結果の標準出力/標準エラー出力をリダイレクト先へ書き込み、
 * 実際に端末(またはパイプ)へ流れる分だけを返す。
 * `> file 2>&1` のように複数のfdが同じパスへ書き込む場合、実シェルではfdを共有して
 * 追記され続けるため、最初に登場した方のopenモード(truncate/append)を採用し、
 * 以降は連結してから1回で書き込む(2回に分けて書くと2回目がtruncateで1回目を消してしまうため)。
 */
export function applyOutputRedirects(
  vfs: VirtualFileSystem,
  stdout: ChannelTarget,
  stderr: ChannelTarget,
  stdoutContent: string,
  stderrContent: string,
): { terminalStdout: string; terminalStderr: string } {
  const grouped = new Map<string, { append: boolean; text: string }>();

  for (const { target, text } of [
    { target: stdout, text: stdoutContent },
    { target: stderr, text: stderrContent },
  ]) {
    if (target.kind !== "file") continue;
    const existing = grouped.get(target.path);
    if (existing) {
      existing.text += text;
    } else {
      grouped.set(target.path, { append: target.append, text });
    }
  }

  const writeErrors: string[] = [];
  for (const [path, { append, text }] of grouped) {
    try {
      if (append) vfs.appendFile(path, text);
      else vfs.writeFile(path, text);
    } catch (caught) {
      writeErrors.push(formatRedirectError(path, caught));
    }
  }

  return {
    terminalStdout: stdout.kind === "terminal" ? stdoutContent : "",
    terminalStderr: (stderr.kind === "terminal" ? stderrContent : "") + writeErrors.join(""),
  };
}
