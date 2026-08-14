import { joinPath } from "../vfs";
import type { VirtualFileSystem } from "../vfs";
import { GitError } from "./errors";
import { hashObject } from "./hash";
import { gitDir } from "./repo";
import type { GitObject } from "./types";

/**
 * 実Gitの`.git/objects/xx/yyyy...`のような2階層シャーディングは行わず、
 * `.git/objects/<hash>`のフラットな1階層に格納する(3.3節)。
 */
function objectPath(repoPath: string, hash: string): string {
  return joinPath(gitDir(repoPath), "objects", hash);
}

/** オブジェクトを内容から決定的に計算したハッシュで書き込む(既に存在すれば何もしない)。 */
export function writeObject(vfs: VirtualFileSystem, repoPath: string, object: GitObject): string {
  const hash = hashObject(object);
  const path = objectPath(repoPath, hash);
  if (!vfs.exists(path)) {
    vfs.writeFile(path, JSON.stringify(object));
  }
  return hash;
}

export function readObject(vfs: VirtualFileSystem, repoPath: string, hash: string): GitObject {
  const path = objectPath(repoPath, hash);
  if (!vfs.exists(path)) {
    throw new GitError(`unable to read object: ${hash}`);
  }
  return JSON.parse(vfs.readFile(path)) as GitObject;
}

export function objectExists(vfs: VirtualFileSystem, repoPath: string, hash: string): boolean {
  return vfs.exists(objectPath(repoPath, hash));
}
