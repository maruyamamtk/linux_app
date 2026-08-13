import { describe, expect, it } from "vitest";

import { VirtualFileSystem } from "../engine/vfs";
import type { VfsUser } from "../engine/vfs";
import { phase1VfsSnapshot } from "./vfsSeed";

const STUDY_USER: VfsUser = { name: "study", groups: ["study"] };
const ROOT_USER: VfsUser = { name: "root", groups: ["root"], isRoot: true };

function createVfs(user: VfsUser = STUDY_USER): VirtualFileSystem {
  return new VirtualFileSystem(phase1VfsSnapshot, user);
}

describe("phase1VfsSnapshot / /etc", () => {
  it("has a 7-field, 20-line /etc/passwd containing the study user", () => {
    const vfs = createVfs(ROOT_USER);
    const lines = vfs.readFile("/etc/passwd").trim().split("\n");
    expect(lines).toHaveLength(20);
    for (const line of lines) {
      expect(line.split(":")).toHaveLength(7);
    }
    expect(lines.some((line) => line.startsWith("study:"))).toBe(true);
  });

  it("blocks the study user from writing to /etc but allows root", () => {
    const asStudy = createVfs(STUDY_USER);
    expect(() => asStudy.writeFile("/etc/passwd", "hacked")).toThrow();

    const asRoot = createVfs(ROOT_USER);
    expect(() => asRoot.readFile("/etc/passwd")).not.toThrow();
  });
});

describe("phase1VfsSnapshot / /bin, /usr/bin", () => {
  it("lists dummy executables with sizes but no content", () => {
    const vfs = createVfs(ROOT_USER);
    const binEntries = vfs.readdir("/bin");
    expect(binEntries.length).toBeGreaterThan(0);
    for (const entry of binEntries) {
      expect(entry.size).toBeGreaterThan(0);
    }
    expect(vfs.readFile("/bin/ls")).toBe("");

    const usrBinEntries = vfs.readdir("/usr/bin");
    expect(usrBinEntries.length).toBeGreaterThan(0);
  });
});

describe("phase1VfsSnapshot / /home/study/practice", () => {
  it("contains one directory per Phase1 chapter (ch04-ch17)", () => {
    const vfs = createVfs();
    const chapterDirs = [
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
    for (const dir of chapterDirs) {
      expect(vfs.stat(`/home/study/practice/${dir}`).type).toBe("directory");
    }
  });

  it("does not include the not-yet-implemented Phase2 chapter (ch19)", () => {
    const vfs = createVfs();
    expect(vfs.exists("/home/study/practice/ch19_git")).toBe(false);
  });

  it("contains ch18_archive/project with multiple files for archive practice", () => {
    const vfs = createVfs();
    expect(vfs.stat("/home/study/practice/ch18_archive/project").type).toBe("directory");
    expect(vfs.stat("/home/study/practice/ch18_archive/project/README.md").type).toBe("file");
    expect(vfs.stat("/home/study/practice/ch18_archive/project/data.csv").type).toBe("file");
    expect(vfs.stat("/home/study/practice/ch18_archive/project/src/app.sh").type).toBe("file");
  });

  it("resolves the deeply nested find target under ch06_search", () => {
    const vfs = createVfs();
    const stat = vfs.stat("/home/study/practice/ch06_search/deep/a/b/c/target.txt");
    expect(stat.type).toBe("file");
  });

  it("sets ch09_permissions modes to reproduce the permission-error exercises", () => {
    const vfs = createVfs();
    const secret = vfs.stat("/home/study/practice/ch09_permissions/secret.txt");
    expect(secret.mode).toBe(0o600);

    const script = vfs.stat("/home/study/practice/ch09_permissions/script.sh");
    expect(script.mode & 0o111).toBe(0);
  });

  it("has file1.txt/file2.txt with duplicate prefecture names for sort/uniq practice", () => {
    const vfs = createVfs();
    const file1Lines = vfs.readFile("/home/study/practice/ch12_textproc/file1.txt").trim().split("\n");
    expect(new Set(file1Lines).size).toBeLessThan(file1Lines.length);
  });
});

describe("phase1VfsSnapshot / $HOME", () => {
  it("does not create ~/diary (created on first run by the user's own script)", () => {
    const vfs = createVfs();
    expect(vfs.exists("/home/study/diary")).toBe(false);
  });

  it("allows study to write under their own home directory", () => {
    const vfs = createVfs();
    expect(() => vfs.writeFile("/home/study/practice/ch04_fs/new.txt", "hi")).not.toThrow();
  });
});
