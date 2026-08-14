import { describe, expect, it } from "vitest";

import { joinPath } from "../vfs";
import { gitCommand } from "./git";
import { buildContext } from "./testFixtures";
import type { CommandContext } from "./types";

/** `/home/study/repo`に`git init`済みのコンテキストを構築する。 */
function buildRepoContext(): CommandContext {
  const context = buildContext();
  gitCommand(["init", "repo"], context);
  context.cwd = "/home/study/repo";
  return context;
}

/** `context.cwd`配下に`path`を書き込み、add+commitする。 */
function commitFile(context: CommandContext, path: string, content: string, message: string): void {
  context.vfs.writeFile(joinPath(context.cwd, path), content);
  gitCommand(["add", path], context);
  gitCommand(["commit", "-m", message], context);
}

/** ローカルリポジトリに`/home/study/remote`を疑似リモート(`origin`)として登録する。 */
function setupRemote(context: CommandContext): void {
  gitCommand(["init", "/home/study/remote"], context);
  gitCommand(["remote", "add", "origin", "/home/study/remote"], context);
}

describe("git init", () => {
  it("creates the .git layout and reports success", () => {
    const context = buildContext();
    const result = gitCommand(["init", "repo"], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Initialized empty Git repository");
    expect(context.vfs.exists("/home/study/repo/.git/HEAD")).toBe(true);
    expect(context.vfs.readFile("/home/study/repo/.git/HEAD")).toBe("ref: refs/heads/main\n");
  });

  it("reports reinitialization for an existing repository", () => {
    const context = buildContext();
    gitCommand(["init", "repo"], context);
    const result = gitCommand(["init", "repo"], context);
    expect(result.stdout).toContain("Reinitialized existing Git repository");
  });
});

describe("git outside a repository", () => {
  it("fails with a 'not a git repository' error", () => {
    const context = buildContext();
    const result = gitCommand(["status"], context);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("not a git repository");
  });
});

describe("git status / add / commit", () => {
  it("shows untracked files, then staged files after add, then a clean tree after commit", () => {
    const context = buildRepoContext();
    context.vfs.writeFile("/home/study/repo/memo.txt", "hello\n");

    const beforeAdd = gitCommand(["status"], context);
    expect(beforeAdd.stdout).toContain("Untracked files:");
    expect(beforeAdd.stdout).toContain("memo.txt");

    gitCommand(["add", "memo.txt"], context);
    const afterAdd = gitCommand(["status"], context);
    expect(afterAdd.stdout).toContain("Changes to be committed:");
    expect(afterAdd.stdout).toContain("new file:");

    const commitResult = gitCommand(["commit", "-m", "Add memo"], context);
    expect(commitResult.exitCode).toBe(0);
    expect(commitResult.stdout).toMatch(/^\[main \(root-commit\) [0-9a-f]{7}\] Add memo\n$/);

    const afterCommit = gitCommand(["status"], context);
    expect(afterCommit.stdout).toBe("On branch main\n\nnothing to commit, working tree clean\n");
  });

  it("'git add .' stages every file under the current directory recursively", () => {
    const context = buildRepoContext();
    context.vfs.mkdir("/home/study/repo/src");
    context.vfs.writeFile("/home/study/repo/a.txt", "a\n");
    context.vfs.writeFile("/home/study/repo/src/b.txt", "b\n");

    gitCommand(["add", "."], context);
    const status = gitCommand(["status"], context);
    expect(status.stdout).toContain("new file:   a.txt");
    expect(status.stdout).toContain("new file:   src/b.txt");
  });

  it("commit fails without -m", () => {
    const context = buildRepoContext();
    const result = gitCommand(["commit"], context);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("-m");
  });

  it("commit fails when there is nothing staged that differs from HEAD", () => {
    const context = buildRepoContext();
    context.vfs.writeFile("/home/study/repo/memo.txt", "hello\n");
    gitCommand(["add", "memo.txt"], context);
    gitCommand(["commit", "-m", "first"], context);

    const result = gitCommand(["commit", "-m", "second"], context);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("nothing to commit");
  });
});

describe("git log", () => {
  it("--oneline lists commits from newest to oldest", () => {
    const context = buildRepoContext();
    context.vfs.writeFile("/home/study/repo/a.txt", "a\n");
    gitCommand(["add", "a.txt"], context);
    gitCommand(["commit", "-m", "first"], context);
    context.vfs.writeFile("/home/study/repo/b.txt", "b\n");
    gitCommand(["add", "b.txt"], context);
    gitCommand(["commit", "-m", "second"], context);

    const result = gitCommand(["log", "--oneline"], context);
    const lines = result.stdout.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("second");
    expect(lines[1]).toContain("first");
  });
});

describe("git branch / checkout / switch", () => {
  it("lists branches with the current one marked by '*'", () => {
    const context = buildRepoContext();
    context.vfs.writeFile("/home/study/repo/a.txt", "a\n");
    gitCommand(["add", "a.txt"], context);
    gitCommand(["commit", "-m", "first"], context);
    gitCommand(["branch", "feature"], context);

    const result = gitCommand(["branch"], context);
    expect(result.stdout).toBe("  feature\n* main\n");
  });

  it("checkout -b creates and switches to a new branch, materializing the same tree", () => {
    const context = buildRepoContext();
    context.vfs.writeFile("/home/study/repo/a.txt", "a\n");
    gitCommand(["add", "a.txt"], context);
    gitCommand(["commit", "-m", "first"], context);

    const result = gitCommand(["checkout", "-b", "feature"], context);
    expect(result.exitCode).toBe(0);
    expect(context.vfs.readFile("/home/study/repo/.git/HEAD")).toBe("ref: refs/heads/feature\n");
    expect(context.vfs.readFile("/home/study/repo/a.txt")).toBe("a\n");
  });

  it("checkout materializes the target branch's files and removes files unique to the source branch", () => {
    const context = buildRepoContext();
    context.vfs.writeFile("/home/study/repo/a.txt", "a\n");
    gitCommand(["add", "a.txt"], context);
    gitCommand(["commit", "-m", "first"], context);
    gitCommand(["checkout", "-b", "feature"], context);
    context.vfs.writeFile("/home/study/repo/feature-only.txt", "feature\n");
    gitCommand(["add", "feature-only.txt"], context);
    gitCommand(["commit", "-m", "feature change"], context);

    gitCommand(["checkout", "main"], context);

    expect(context.vfs.exists("/home/study/repo/feature-only.txt")).toBe(false);
    expect(context.vfs.readFile("/home/study/repo/a.txt")).toBe("a\n");
  });

  it("refuses to switch branches when there are uncommitted changes", () => {
    const context = buildRepoContext();
    context.vfs.writeFile("/home/study/repo/a.txt", "a\n");
    gitCommand(["add", "a.txt"], context);
    gitCommand(["commit", "-m", "first"], context);
    gitCommand(["branch", "feature"], context);

    context.vfs.writeFile("/home/study/repo/a.txt", "changed\n");
    context.vfs.writeFile("/home/study/repo/staged.txt", "staged\n");
    gitCommand(["add", "a.txt", "staged.txt"], context);

    const result = gitCommand(["switch", "feature"], context);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("would be overwritten");
  });
});

describe("git merge", () => {
  it("fast-forwards when the current branch is an ancestor of the merged branch", () => {
    const context = buildRepoContext();
    commitFile(context, "a.txt", "a\n", "first");
    gitCommand(["checkout", "-b", "feature"], context);
    commitFile(context, "feature.txt", "feature\n", "feature change");
    gitCommand(["checkout", "main"], context);

    const result = gitCommand(["merge", "feature"], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Fast-forward");
    expect(context.vfs.readFile("/home/study/repo/feature.txt")).toBe("feature\n");
  });

  it("creates a merge commit for non-conflicting diverged branches", () => {
    const context = buildRepoContext();
    commitFile(context, "a.txt", "a\n", "first");
    gitCommand(["checkout", "-b", "feature"], context);
    commitFile(context, "feature.txt", "feature\n", "feature change");
    gitCommand(["checkout", "main"], context);
    commitFile(context, "main.txt", "main\n", "main change");

    const result = gitCommand(["merge", "feature"], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Merge made by the 'recursive' strategy.");
    expect(context.vfs.readFile("/home/study/repo/feature.txt")).toBe("feature\n");
    expect(context.vfs.readFile("/home/study/repo/main.txt")).toBe("main\n");

    const log = gitCommand(["log", "--oneline"], context);
    expect(log.stdout.trim().split("\n")).toHaveLength(4);
  });

  it("reports 'Already up to date.' when the branch is already merged", () => {
    const context = buildRepoContext();
    commitFile(context, "a.txt", "a\n", "first");
    gitCommand(["branch", "feature"], context);

    const result = gitCommand(["merge", "feature"], context);
    expect(result.stdout).toBe("Already up to date.\n");
  });

  it("fails with a CONFLICT message and leaves branches unchanged when both sides edit the same file", () => {
    const context = buildRepoContext();
    commitFile(context, "shared.txt", "base\n", "base");
    gitCommand(["checkout", "-b", "feature"], context);
    commitFile(context, "shared.txt", "feature version\n", "feature edits shared");
    gitCommand(["checkout", "main"], context);
    commitFile(context, "shared.txt", "main version\n", "main edits shared");

    const result = gitCommand(["merge", "feature"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("CONFLICT (content): Merge conflict in shared.txt");
    expect(context.vfs.readFile("/home/study/repo/shared.txt")).toBe("main version\n");
  });
});

describe("git remote", () => {
  it("lists remote names without -v", () => {
    const context = buildRepoContext();
    setupRemote(context);

    const result = gitCommand(["remote"], context);
    expect(result.stdout).toBe("origin\n");
  });

  it("-v lists fetch/push urls", () => {
    const context = buildRepoContext();
    setupRemote(context);

    const result = gitCommand(["remote", "-v"], context);
    expect(result.stdout).toBe("origin\t/home/study/remote (fetch)\norigin\t/home/study/remote (push)\n");
  });
});

describe("git push", () => {
  it("fails without a configured remote", () => {
    const context = buildRepoContext();
    commitFile(context, "a.txt", "a\n", "first");

    const result = gitCommand(["push"], context);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("does not appear to be a git repository");
  });

  it("fails when the local branch has no commits yet", () => {
    const context = buildRepoContext();
    setupRemote(context);

    const result = gitCommand(["push"], context);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("src refspec");
  });

  it("copies commits to the remote and updates its branch ref", () => {
    const context = buildRepoContext();
    setupRemote(context);
    commitFile(context, "a.txt", "a\n", "first");

    const result = gitCommand(["push"], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("main -> main");

    const remoteContext = { ...context, cwd: "/home/study/remote" };
    const log = gitCommand(["log", "--oneline"], remoteContext);
    expect(log.stdout).toContain("first");
  });

  it("reports 'Everything up-to-date' when the remote already has the local commits", () => {
    const context = buildRepoContext();
    setupRemote(context);
    commitFile(context, "a.txt", "a\n", "first");
    gitCommand(["push"], context);

    const result = gitCommand(["push"], context);
    expect(result.stdout).toBe("Everything up-to-date\n");
  });

  it("rejects a non-fast-forward push and leaves the remote branch untouched", () => {
    const context = buildRepoContext();
    setupRemote(context);
    commitFile(context, "a.txt", "a\n", "first");
    gitCommand(["push"], context);

    const remoteContext = { ...context, cwd: "/home/study/remote" };
    commitFile(remoteContext, "remote-only.txt", "remote\n", "remote change");
    commitFile(context, "local-only.txt", "local\n", "local change");

    const result = gitCommand(["push"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("[rejected]");
    expect(result.stderr).toContain("non-fast-forward");

    const remoteLog = gitCommand(["log", "--oneline"], remoteContext);
    expect(remoteLog.stdout).not.toContain("local change");
  });
});

describe("git pull", () => {
  it("fails without a configured remote", () => {
    const context = buildRepoContext();
    const result = gitCommand(["pull"], context);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("does not appear to be a git repository");
  });

  it("fast-forwards the local branch when the remote is ahead", () => {
    const context = buildRepoContext();
    setupRemote(context);
    commitFile(context, "a.txt", "a\n", "first");
    gitCommand(["push"], context);

    const remoteContext = { ...context, cwd: "/home/study/remote" };
    commitFile(remoteContext, "b.txt", "b\n", "second");

    const result = gitCommand(["pull"], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Fast-forward");
    expect(context.vfs.readFile("/home/study/repo/b.txt")).toBe("b\n");
  });

  it("creates a merge commit for non-conflicting diverged changes", () => {
    const context = buildRepoContext();
    setupRemote(context);
    commitFile(context, "base.txt", "base\n", "base");
    gitCommand(["push"], context);

    const remoteContext = { ...context, cwd: "/home/study/remote" };
    commitFile(remoteContext, "remote-only.txt", "remote\n", "remote change");
    commitFile(context, "local-only.txt", "local\n", "local change");

    const result = gitCommand(["pull"], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Merge made by the 'recursive' strategy.");
    expect(context.vfs.readFile("/home/study/repo/remote-only.txt")).toBe("remote\n");
    expect(context.vfs.readFile("/home/study/repo/local-only.txt")).toBe("local\n");
  });

  it("fails with a CONFLICT message and leaves refs unchanged when both sides edit the same file", () => {
    const context = buildRepoContext();
    setupRemote(context);
    commitFile(context, "shared.txt", "base\n", "base");
    gitCommand(["push"], context);

    const remoteContext = { ...context, cwd: "/home/study/remote" };
    commitFile(remoteContext, "shared.txt", "remote version\n", "remote edits shared");
    commitFile(context, "shared.txt", "local version\n", "local edits shared");

    const result = gitCommand(["pull"], context);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("CONFLICT (content): Merge conflict in shared.txt");
    expect(context.vfs.readFile("/home/study/repo/shared.txt")).toBe("local version\n");
  });
});

describe("unsupported git subcommands", () => {
  it("fails with a descriptive error instead of silently doing nothing", () => {
    const context = buildRepoContext();
    const result = gitCommand(["clone", "/tmp/other"], context);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("not a supported command in this simulator");
  });
});
