import { describe, expect, it } from "vitest";

import type { VfsUser } from "../engine/vfs";
import { VirtualFileSystem } from "../engine/vfs";
import { phase1VfsSnapshot } from "./vfsSeed";

const STUDY_USER: VfsUser = { name: "study", groups: ["study"] };
const ROOT_USER: VfsUser = { name: "root", groups: ["root"], isRoot: true };

function createVfs(user: VfsUser = STUDY_USER): VirtualFileSystem {
  return new VirtualFileSystem(phase1VfsSnapshot, user);
}

describe("phase1VfsSnapshot", () => {
  it("exposes the practice directories for ch04 through ch17", () => {
    const vfs = createVfs();
    const chapters = [
      "ch04_fs",
      "ch05_fileops",
      "ch06_search",
      "ch09_permissions",
      "ch11_pipeline",
      "ch12_textproc",
      "ch13_regex",
      "ch14_sedawk",
      "ch15_17_shellscript",
    ];
    for (const chapter of chapters) {
      expect(vfs.stat(`/home/study/practice/${chapter}`).type).toBe("directory");
    }
  });

  it("has a 20-field-line /etc/passwd with a 7-field format", () => {
    const vfs = createVfs();
    const lines = vfs.readFile("/etc/passwd").trim().split("\n");
    expect(lines).toHaveLength(20);
    for (const line of lines) {
      expect(line.split(":")).toHaveLength(7);
    }
  });

  it("blocks the study user from writing to /etc", () => {
    const vfs = createVfs(STUDY_USER);
    expect(() => vfs.writeFile("/etc/passwd", "hacked")).toThrow();
  });

  it("allows root to read /etc/passwd", () => {
    const vfs = createVfs(ROOT_USER);
    expect(vfs.readFile("/etc/passwd")).toContain("root:x:0:0:root:/root:/bin/bash");
  });

  it("exposes dummy executables in /bin and /usr/bin with sizes but no content", () => {
    const vfs = createVfs();
    const bin = vfs.readdir("/bin");
    expect(bin.length).toBeGreaterThan(0);
    for (const entry of bin) {
      expect(entry.type).toBe("file");
      expect(entry.size).toBeGreaterThan(0);
    }
    expect(vfs.readFile("/bin/ls")).toBe("");

    const usrBin = vfs.readdir("/usr/bin");
    expect(usrBin.length).toBeGreaterThan(0);
  });

  it("finds the deeply nested find-exercise target file", () => {
    const vfs = createVfs();
    expect(vfs.stat("/home/study/practice/ch06_search/deep/a/b/c/target.txt").type).toBe("file");
  });

  it("keeps ch09_permissions/secret.txt at mode 600 and script.sh non-executable", () => {
    const vfs = createVfs();
    expect(vfs.stat("/home/study/practice/ch09_permissions/secret.txt").mode).toBe(0o600);
    expect(vfs.stat("/home/study/practice/ch09_permissions/script.sh").mode).toBe(0o644);
  });

  it("does not pre-create ~/diary (created on first script run)", () => {
    const vfs = createVfs();
    expect(vfs.exists("/home/study/diary")).toBe(false);
  });

  it("allows the study user to write inside their own home directory", () => {
    const vfs = createVfs();
    vfs.writeFile("/home/study/practice/ch15_17_shellscript/homesize.sh", "#!/bin/bash\n");
    expect(vfs.readFile("/home/study/practice/ch15_17_shellscript/homesize.sh")).toContain(
      "#!/bin/bash",
    );
  });
});
