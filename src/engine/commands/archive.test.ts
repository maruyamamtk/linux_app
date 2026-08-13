import { describe, expect, it } from "vitest";

import {
  bunzip2Command,
  bzip2Command,
  gunzipCommand,
  gzipCommand,
  tarCommand,
  unzipCommand,
  zipCommand,
} from "./archive";
import { buildContext } from "./testFixtures";

describe("tar", () => {
  it("creates an archive and lists its contents", () => {
    const context = buildContext();
    const created = tarCommand(["-cvf", "backup.tar", "file1.txt", "docs"], context);
    expect(created.exitCode).toBe(0);
    expect(created.stdout).toBe("file1.txt\ndocs/\ndocs/a.txt\n");
    expect(context.vfs.exists("/home/study/backup.tar")).toBe(true);

    const listed = tarCommand(["-tf", "backup.tar"], context);
    expect(listed.stdout).toBe("file1.txt\ndocs/\ndocs/a.txt\n");
    expect(listed.exitCode).toBe(0);
  });

  it("supports old-style options without a leading dash", () => {
    const context = buildContext();
    const created = tarCommand(["cvf", "backup.tar", "file1.txt"], context);
    expect(created.exitCode).toBe(0);
    expect(created.stdout).toBe("file1.txt\n");
  });

  it("extracts files and nested directories, recreating original content", () => {
    const context = buildContext();
    tarCommand(["-cf", "backup.tar", "file1.txt", "docs"], context);
    context.vfs.remove("/home/study/file1.txt");
    context.vfs.remove("/home/study/docs", { recursive: true });

    const extracted = tarCommand(["-xvf", "backup.tar"], context);
    expect(extracted.exitCode).toBe(0);
    expect(extracted.stdout).toBe("file1.txt\ndocs/\ndocs/a.txt\n");
    expect(context.vfs.readFile("/home/study/file1.txt")).toBe("hello\n");
    expect(context.vfs.readFile("/home/study/docs/a.txt")).toBe("A\n");
  });

  it("round-trips through gzip compression via -z", () => {
    const context = buildContext();
    tarCommand(["-czf", "backup.tar.gz", "file1.txt"], context);
    context.vfs.remove("/home/study/file1.txt");

    const extracted = tarCommand(["-xzf", "backup.tar.gz"], context);
    expect(extracted.exitCode).toBe(0);
    expect(context.vfs.readFile("/home/study/file1.txt")).toBe("hello\n");
  });

  it("round-trips through bzip2 compression via -j", () => {
    const context = buildContext();
    tarCommand(["-cjf", "backup.tar.bz2", "file1.txt"], context);
    context.vfs.remove("/home/study/file1.txt");

    const extracted = tarCommand(["-xjf", "backup.tar.bz2"], context);
    expect(extracted.exitCode).toBe(0);
    expect(context.vfs.readFile("/home/study/file1.txt")).toBe("hello\n");
  });

  it("refuses to create an empty archive", () => {
    const context = buildContext();
    const result = tarCommand(["-cf", "backup.tar"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Cowardly refusing to create an empty archive");
  });

  it("requires exactly one of c/x/t", () => {
    const context = buildContext();
    const result = tarCommand(["-vf", "backup.tar"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("You must specify one of the '-ctx' options");
  });

  it("reports missing sources when creating", () => {
    const context = buildContext();
    const result = tarCommand(["-cf", "backup.tar", "missing.txt"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("No such file or directory");
    expect(context.vfs.exists("/home/study/backup.tar")).toBe(false);
  });

  it("errors when extracting a non-tar file", () => {
    const context = buildContext();
    context.vfs.writeFile("/home/study/plain.tar", "not json");
    const result = tarCommand(["-xf", "plain.tar"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("does not look like a tar archive");
  });
});

describe("gzip / gunzip", () => {
  it("compresses a file, removing the original, then decompresses it back", () => {
    const context = buildContext();
    const compressed = gzipCommand(["file1.txt"], context);
    expect(compressed.exitCode).toBe(0);
    expect(context.vfs.exists("/home/study/file1.txt")).toBe(false);
    expect(context.vfs.exists("/home/study/file1.txt.gz")).toBe(true);

    const decompressed = gunzipCommand(["file1.txt.gz"], context);
    expect(decompressed.exitCode).toBe(0);
    expect(context.vfs.exists("/home/study/file1.txt.gz")).toBe(false);
    expect(context.vfs.readFile("/home/study/file1.txt")).toBe("hello\n");
  });

  it("keeps the original file when -k is given", () => {
    const context = buildContext();
    gzipCommand(["-k", "file1.txt"], context);
    expect(context.vfs.exists("/home/study/file1.txt")).toBe(true);
    expect(context.vfs.exists("/home/study/file1.txt.gz")).toBe(true);
  });

  it("refuses to compress a directory", () => {
    const context = buildContext();
    const result = gzipCommand(["docs"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("is a directory -- ignored");
  });

  it("gunzip rejects files without a .gz suffix", () => {
    const context = buildContext();
    const result = gunzipCommand(["file1.txt"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("unknown suffix -- ignored");
  });

  it("gzip -d behaves like gunzip", () => {
    const context = buildContext();
    gzipCommand(["file1.txt"], context);
    const result = gzipCommand(["-d", "file1.txt.gz"], context);
    expect(result.exitCode).toBe(0);
    expect(context.vfs.readFile("/home/study/file1.txt")).toBe("hello\n");
  });
});

describe("bzip2 / bunzip2", () => {
  it("compresses and decompresses a file", () => {
    const context = buildContext();
    bzip2Command(["file1.txt"], context);
    expect(context.vfs.exists("/home/study/file1.txt.bz2")).toBe(true);
    expect(context.vfs.exists("/home/study/file1.txt")).toBe(false);

    bunzip2Command(["file1.txt.bz2"], context);
    expect(context.vfs.readFile("/home/study/file1.txt")).toBe("hello\n");
  });
});

describe("gzip and tar interop", () => {
  it("gunzip on a tar.gz archive recovers a plain .tar file that tar can then extract", () => {
    const context = buildContext();
    tarCommand(["-czf", "backup.tar.gz", "file1.txt"], context);

    const decompressed = gunzipCommand(["backup.tar.gz"], context);
    expect(decompressed.exitCode).toBe(0);
    expect(context.vfs.exists("/home/study/backup.tar")).toBe(true);

    context.vfs.remove("/home/study/file1.txt");
    const extracted = tarCommand(["-xf", "backup.tar"], context);
    expect(extracted.exitCode).toBe(0);
    expect(context.vfs.readFile("/home/study/file1.txt")).toBe("hello\n");
  });
});

describe("zip / unzip", () => {
  it("adds files without recursing into directories unless -r is given", () => {
    const context = buildContext();
    const result = zipCommand(["archive.zip", "file1.txt", "docs"], context);
    expect(result.exitCode).toBe(0);

    const listing = unzipCommand(["-l", "archive.zip"], context);
    expect(listing.stdout).toContain("file1.txt");
    expect(listing.stdout).toContain("docs/");
    expect(listing.stdout).not.toContain("docs/a.txt");
  });

  it("recurses into directories with -r", () => {
    const context = buildContext();
    zipCommand(["-r", "archive.zip", "docs"], context);
    const listing = unzipCommand(["-l", "archive.zip"], context);
    expect(listing.stdout).toContain("docs/a.txt");
  });

  it("extracts files and directories back into the VFS", () => {
    const context = buildContext();
    zipCommand(["-r", "archive.zip", "docs"], context);
    context.vfs.remove("/home/study/docs", { recursive: true });

    const result = unzipCommand(["archive.zip"], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("inflating: docs/a.txt");
    expect(context.vfs.readFile("/home/study/docs/a.txt")).toBe("A\n");
  });

  it("merges new entries into an existing archive without dropping previous ones", () => {
    const context = buildContext();
    zipCommand(["archive.zip", "file1.txt"], context);
    zipCommand(["-r", "archive.zip", "docs"], context);

    const listing = unzipCommand(["-l", "archive.zip"], context);
    expect(listing.stdout).toContain("file1.txt");
    expect(listing.stdout).toContain("docs/a.txt");
  });

  it("errors when the zip file does not exist", () => {
    const context = buildContext();
    const result = unzipCommand(["missing.zip"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("cannot find or open");
  });
});
