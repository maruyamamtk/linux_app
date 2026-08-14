import { joinPath } from "../vfs";
import type { VirtualFileSystem } from "../vfs";
import { gitDir } from "./repo";
import type { GitConfig } from "./types";

function configPath(repoPath: string): string {
  return joinPath(gitDir(repoPath), "config");
}

/** `.git/config`(design 3.6節)。存在しない場合はリモート未設定として扱う。 */
export function readConfig(vfs: VirtualFileSystem, repoPath: string): GitConfig {
  const path = configPath(repoPath);
  if (!vfs.exists(path)) return { remotes: {} };
  return JSON.parse(vfs.readFile(path)) as GitConfig;
}

export function writeConfig(vfs: VirtualFileSystem, repoPath: string, config: GitConfig): void {
  vfs.writeFile(configPath(repoPath), `${JSON.stringify(config)}\n`);
}

export function getRemoteUrl(vfs: VirtualFileSystem, repoPath: string, name: string): string | undefined {
  return readConfig(vfs, repoPath).remotes[name];
}

/** `git remote add <name> <url>`(design 5.9節)。既存の同名リモートは上書きする。 */
export function setRemoteUrl(vfs: VirtualFileSystem, repoPath: string, name: string, url: string): void {
  const config = readConfig(vfs, repoPath);
  writeConfig(vfs, repoPath, { remotes: { ...config.remotes, [name]: url } });
}
