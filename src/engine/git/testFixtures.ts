import { createDirectory, VirtualFileSystem } from "../vfs";
import type { VfsSnapshot, VfsUser } from "../vfs";
import { initRepo } from "./repo";

export const STUDY_USER: VfsUser = { name: "study", groups: ["study"] };

export const REPO_PATH = "/home/study/repo";

function buildSnapshot(): VfsSnapshot {
  const root = createDirectory(
    "",
    {
      home: createDirectory(
        "home",
        {
          study: createDirectory(
            "study",
            {
              repo: createDirectory("repo", {}, { owner: "study", group: "study", mode: 0o755 }),
            },
            { owner: "study", group: "study", mode: 0o755 },
          ),
        },
        { owner: "root", group: "root", mode: 0o755 },
      ),
    },
    { owner: "root", group: "root", mode: 0o755 },
  );
  return { id: "git-test-snapshot", root };
}

/** `REPO_PATH`に`git init`済みの空リポジトリを持つVFSを構築する。 */
export function buildRepo(user: VfsUser = STUDY_USER): VirtualFileSystem {
  const vfs = new VirtualFileSystem(buildSnapshot(), user);
  initRepo(vfs, REPO_PATH);
  return vfs;
}
