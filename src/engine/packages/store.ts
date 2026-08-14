import { dirname } from "../vfs";
import type { VirtualFileSystem } from "../vfs";

/** インストール済みパッケージ名の一覧を永続化するパス(design: `.git`と同様VFS内に状態を持たせる)。 */
export const INSTALLED_DB_PATH = "/var/lib/pkg/installed.json";

export function readInstalledPackages(vfs: VirtualFileSystem): string[] {
  if (!vfs.exists(INSTALLED_DB_PATH)) return [];
  try {
    const parsed = JSON.parse(vfs.readFile(INSTALLED_DB_PATH)) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function isPackageInstalled(vfs: VirtualFileSystem, name: string): boolean {
  return readInstalledPackages(vfs).includes(name);
}

/**
 * インストール済みパッケージDBへ追記する。`/var`配下はroot所有で作成されるため、
 * 呼び出し側(`dnf`/`apt install`)はroot権限であることを事前に確認しておく必要がある。
 */
export function recordInstalledPackages(vfs: VirtualFileSystem, names: readonly string[]): void {
  const current = new Set(readInstalledPackages(vfs));
  for (const name of names) current.add(name);

  const dir = dirname(INSTALLED_DB_PATH);
  if (!vfs.exists(dir)) vfs.mkdir(dir, { recursive: true });
  vfs.writeFile(INSTALLED_DB_PATH, `${JSON.stringify([...current].sort())}\n`);
}
