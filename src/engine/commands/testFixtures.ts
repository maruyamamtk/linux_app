import { createDirectory, createFile, VirtualFileSystem } from "../vfs";
import type { VfsSnapshot, VfsUser } from "../vfs";
import type { CommandContext } from "./types";

export const STUDY_USER: VfsUser = { name: "study", groups: ["study"] };
export const ROOT_USER: VfsUser = { name: "root", groups: ["root"], isRoot: true };

/** コマンド群のテストで共有する、Ch4-6演習を模した最小限のVFSスナップショット。 */
export function buildSnapshot(): VfsSnapshot {
  const root = createDirectory(
    "",
    {
      bin: createDirectory(
        "bin",
        {
          ls: createFile("ls", "", { owner: "root", group: "root", mode: 0o755, size: 100 }),
        },
        { owner: "root", group: "root", mode: 0o755 },
      ),
      etc: createDirectory(
        "etc",
        {
          passwd: createFile("passwd", "root:x:0:0\n", { owner: "root", group: "root", mode: 0o644 }),
        },
        { owner: "root", group: "root", mode: 0o755 },
      ),
      home: createDirectory(
        "home",
        {
          study: createDirectory(
            "study",
            {
              "file1.txt": createFile("file1.txt", "hello\n", {
                owner: "study",
                group: "study",
                mode: 0o644,
              }),
              ".hidden": createFile(".hidden", "secret\n", {
                owner: "study",
                group: "study",
                mode: 0o644,
              }),
              docs: createDirectory(
                "docs",
                {
                  "a.txt": createFile("a.txt", "A\n", { owner: "study", group: "study", mode: 0o644 }),
                },
                { owner: "study", group: "study", mode: 0o755 },
              ),
              empty: createDirectory("empty", {}, { owner: "study", group: "study", mode: 0o755 }),
            },
            { owner: "study", group: "study", mode: 0o755 },
          ),
        },
        { owner: "root", group: "root", mode: 0o755 },
      ),
    },
    { owner: "root", group: "root", mode: 0o755 },
  );

  return { id: "commands-test-snapshot", root };
}

export function buildContext(user: VfsUser = STUDY_USER, cwd = "/home/study"): CommandContext {
  return {
    vfs: new VirtualFileSystem(buildSnapshot(), user),
    cwd,
    env: { HOME: "/home/study", PATH: "/bin:/usr/bin" },
  };
}
