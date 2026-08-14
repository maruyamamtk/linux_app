import { dirname, joinPath, normalizePath } from "../vfs";
import type { VirtualFileSystem } from "../vfs";

export const GIT_DIR = ".git";

export function gitDir(repoPath: string): string {
  return joinPath(repoPath, GIT_DIR);
}

/** `cwd`から上位ディレクトリへ`.git`を探す(実Gitと同様、サブディレクトリからの実行に対応)。 */
export function findRepoRoot(vfs: VirtualFileSystem, startPath: string): string | undefined {
  let current = normalizePath(startPath);
  for (;;) {
    const candidate = gitDir(current);
    if (vfs.exists(candidate) && vfs.stat(candidate).type === "directory") {
      return current;
    }
    if (current === "/") return undefined;
    current = dirname(current);
  }
}

/**
 * `.git/`のレイアウト(3.3節)を作成する。既存リポジトリに対して呼ばれた場合(実Gitの
 * `git init`の再実行と同様)は何もしない。
 */
export function initRepo(vfs: VirtualFileSystem, repoPath: string): void {
  const dir = gitDir(repoPath);
  if (vfs.exists(dir)) return;

  vfs.mkdir(joinPath(dir, "objects"), { recursive: true });
  vfs.mkdir(joinPath(dir, "refs", "heads"), { recursive: true });
  vfs.writeFile(joinPath(dir, "HEAD"), "ref: refs/heads/main\n");
  vfs.writeFile(joinPath(dir, "index"), "[]\n");
}
