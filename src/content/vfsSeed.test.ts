import { describe, expect, it } from "vitest";

import { VirtualFileSystem } from "../engine/vfs";
import type { VfsSnapshot, VfsUser } from "../engine/vfs";
import { vfsSnapshots } from "./vfsSeed";

const STUDY_USER: VfsUser = { name: "study", groups: ["study"] };
const ROOT_USER: VfsUser = { name: "root", groups: ["root"], isRoot: true };

function createVfs(snapshot: VfsSnapshot, user: VfsUser = STUDY_USER): VirtualFileSystem {
  return new VirtualFileSystem(snapshot, user);
}

describe("vfsSnapshots / shared skeleton", () => {
  it.each(Object.entries(vfsSnapshots))("%s: has a 7-field, 20-line /etc/passwd containing the study user", (_key, snapshot) => {
    const vfs = createVfs(snapshot, ROOT_USER);
    const lines = vfs.readFile("/etc/passwd").trim().split("\n");
    expect(lines).toHaveLength(20);
    for (const line of lines) {
      expect(line.split(":")).toHaveLength(7);
    }
    expect(lines.some((line) => line.startsWith("study:"))).toBe(true);
  });

  it.each(Object.entries(vfsSnapshots))("%s: blocks the study user from writing to /etc but allows root", (_key, snapshot) => {
    const asStudy = createVfs(snapshot, STUDY_USER);
    expect(() => asStudy.writeFile("/etc/passwd", "hacked")).toThrow();

    const asRoot = createVfs(snapshot, ROOT_USER);
    expect(() => asRoot.readFile("/etc/passwd")).not.toThrow();
  });

  it.each(Object.entries(vfsSnapshots))("%s: lists dummy executables with sizes but no content", (_key, snapshot) => {
    const vfs = createVfs(snapshot, ROOT_USER);
    const binEntries = vfs.readdir("/bin");
    expect(binEntries.length).toBeGreaterThan(0);
    for (const entry of binEntries) {
      expect(entry.size).toBeGreaterThan(0);
    }
    expect(vfs.readFile("/bin/ls")).toBe("");

    const usrBinEntries = vfs.readdir("/usr/bin");
    expect(usrBinEntries.length).toBeGreaterThan(0);
  });

  it.each(Object.entries(vfsSnapshots))("%s: has $HOME/.bashrc, .bash_profile and bin", (_key, snapshot) => {
    const vfs = createVfs(snapshot);
    expect(vfs.stat("/home/study/.bashrc").type).toBe("file");
    expect(vfs.stat("/home/study/.bash_profile").type).toBe("file");
    expect(vfs.stat("/home/study/bin").type).toBe("directory");
  });

  it.each(Object.entries(vfsSnapshots))("%s: does not create ~/diary (created on first run by the user's own script)", (_key, snapshot) => {
    const vfs = createVfs(snapshot);
    expect(vfs.exists("/home/study/diary")).toBe(false);
  });

  it.each(Object.entries(vfsSnapshots))("%s: allows study to write under their own home directory", (_key, snapshot) => {
    const vfs = createVfs(snapshot);
    expect(() => vfs.writeFile("/home/study/new.txt", "hi")).not.toThrow();
  });
});

describe("vfsSnapshots.default / /home/study/practice", () => {
  it("has no chapter-specific fixtures", () => {
    const vfs = createVfs(vfsSnapshots.default);
    expect(vfs.readdir("/home/study/practice")).toHaveLength(0);
  });
});

describe("vfsSnapshots['ch04-06'] / /home/study/practice", () => {
  it("contains one directory per Ch4-6 exercise group", () => {
    const vfs = createVfs(vfsSnapshots["ch04-06"]);
    for (const dir of ["ch04_fs", "ch05_fileops", "ch06_search"]) {
      expect(vfs.stat(`/home/study/practice/${dir}`).type).toBe("directory");
    }
  });

  it("resolves the deeply nested find target under ch06_search", () => {
    const vfs = createVfs(vfsSnapshots["ch04-06"]);
    const stat = vfs.stat("/home/study/practice/ch06_search/deep/a/b/c/target.txt");
    expect(stat.type).toBe("file");
  });
});

describe("vfsSnapshots.ch09 / /home/study/practice", () => {
  it("sets ch09_permissions modes to reproduce the permission-error exercises", () => {
    const vfs = createVfs(vfsSnapshots.ch09);
    const secret = vfs.stat("/home/study/practice/ch09_permissions/secret.txt");
    expect(secret.mode).toBe(0o600);

    const script = vfs.stat("/home/study/practice/ch09_permissions/script.sh");
    expect(script.mode & 0o111).toBe(0);
  });
});

describe("vfsSnapshots['ch11-14'] / /home/study/practice", () => {
  it("contains one directory per Ch11-14 exercise group", () => {
    const vfs = createVfs(vfsSnapshots["ch11-14"]);
    for (const dir of ["ch11_pipeline", "ch12_textproc", "ch13_regex", "ch14_sedawk"]) {
      expect(vfs.stat(`/home/study/practice/${dir}`).type).toBe("directory");
    }
  });

  it("has file1.txt/file2.txt with duplicate prefecture names for sort/uniq practice", () => {
    const vfs = createVfs(vfsSnapshots["ch11-14"]);
    const file1Lines = vfs.readFile("/home/study/practice/ch12_textproc/file1.txt").trim().split("\n");
    expect(new Set(file1Lines).size).toBeLessThan(file1Lines.length);
  });
});

describe("vfsSnapshots['ch15-17'] / /home/study/practice", () => {
  it("contains an empty ch15_17_shellscript directory", () => {
    const vfs = createVfs(vfsSnapshots["ch15-17"]);
    expect(vfs.stat("/home/study/practice/ch15_17_shellscript").type).toBe("directory");
  });
});

describe("vfsSnapshots.ch18 / /home/study/practice", () => {
  it("contains ch18_archive/project with multiple files for archive practice", () => {
    const vfs = createVfs(vfsSnapshots.ch18);
    expect(vfs.stat("/home/study/practice/ch18_archive/project").type).toBe("directory");
    expect(vfs.stat("/home/study/practice/ch18_archive/project/README.md").type).toBe("file");
    expect(vfs.stat("/home/study/practice/ch18_archive/project/data.csv").type).toBe("file");
    expect(vfs.stat("/home/study/practice/ch18_archive/project/src/app.sh").type).toBe("file");
  });
});

describe("vfsSnapshots.ch19 / /home/study/practice", () => {
  it("contains ch19_git with a work tree per Git exercise scenario, none pre-initialized as a repo", () => {
    const vfs = createVfs(vfsSnapshots.ch19);
    for (const dir of ["notes", "branch-practice", "sync-practice"]) {
      const path = `/home/study/practice/ch19_git/${dir}`;
      expect(vfs.stat(path).type).toBe("directory");
      expect(vfs.exists(`${path}/.git`)).toBe(false);
    }
    expect(vfs.stat("/home/study/practice/ch19_git/notes/memo.txt").type).toBe("file");
    expect(vfs.stat("/home/study/practice/ch19_git/notes/todo.txt").type).toBe("file");
  });
});
