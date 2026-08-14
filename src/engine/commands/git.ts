import { joinPath, normalizePath, VfsError } from "../vfs";
import {
  GitError,
  GitUnsupportedCommandError,
  branchExists,
  buildTreeFromIndex,
  collectAncestors,
  createCommit,
  fetchBranch,
  findRepoRoot,
  flattenTree,
  formatCommitDate,
  getRemoteUrl,
  gitDir,
  hashObject,
  initRepo,
  listBranches,
  listWorktreeFiles,
  materializeTree,
  performMerge,
  pushBranch,
  readBranchHash,
  readConfig,
  readHeadBranch,
  readIndex,
  readObject,
  setRemoteUrl,
  upsertIndexEntry,
  writeBranchHash,
  writeHeadBranch,
  writeIndex,
  writeObject,
} from "../git";
import type { GitCommitObject, GitFileMode, MergeOutcome } from "../git";
import { parseArgs } from "./args";
import { fail, ok } from "./errors";
import type { CommandContext, CommandHandler, CommandResult } from "./types";

function resolveArgPath(context: CommandContext, path: string): string {
  return normalizePath(path, context.cwd);
}

function relativeToRepo(repoPath: string, absPath: string): string {
  return absPath === repoPath ? "" : absPath.slice(repoPath.length + 1);
}

function fileMode(context: CommandContext, absPath: string): GitFileMode {
  return (context.vfs.stat(absPath).mode & 0o111) !== 0 ? "100755" : "100644";
}

/** `-m "<message>"` / `--message=<message>` を取り出す(argsの単独文字パーサは値付きオプションを扱えないため個別実装)。 */
function extractMessageOption(args: string[]): { message?: string } {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "-m" || arg === "--message") return { message: args[i + 1] };
    if (arg.startsWith("-m=")) return { message: arg.slice(3) };
    if (arg.startsWith("--message=")) return { message: arg.slice("--message=".length) };
  }
  return {};
}

interface GitStatusEntry {
  path: string;
  state: "new" | "modified" | "deleted";
}

interface GitStatusInfo {
  branch: string;
  staged: GitStatusEntry[];
  notStaged: GitStatusEntry[];
  untracked: string[];
}

/** ワークツリー・index・HEADのtreeの3者を比較する(design 3.5節)。 */
function collectStatus(context: CommandContext, repoPath: string): GitStatusInfo {
  const branch = readHeadBranch(context.vfs, repoPath);
  const headHash = readBranchHash(context.vfs, repoPath, branch);
  const headTree = headHash ? (readObject(context.vfs, repoPath, headHash) as GitCommitObject).tree : undefined;
  const headEntries = new Map(flattenTree(context.vfs, repoPath, headTree).map((entry) => [entry.path, entry]));

  const index = readIndex(context.vfs, repoPath);
  const indexEntries = new Map(index.map((entry) => [entry.path, entry]));
  const worktreeFiles = new Set(listWorktreeFiles(context.vfs, repoPath));

  const staged: GitStatusEntry[] = [];
  for (const [path, entry] of indexEntries) {
    const headEntry = headEntries.get(path);
    if (!headEntry) staged.push({ path, state: "new" });
    else if (headEntry.blobHash !== entry.blobHash) staged.push({ path, state: "modified" });
  }
  for (const path of headEntries.keys()) {
    if (!indexEntries.has(path)) staged.push({ path, state: "deleted" });
  }

  const notStaged: GitStatusEntry[] = [];
  for (const [path, entry] of indexEntries) {
    if (!worktreeFiles.has(path)) {
      notStaged.push({ path, state: "deleted" });
      continue;
    }
    const currentHash = hashObject({ type: "blob", content: context.vfs.readFile(joinPath(repoPath, path)) });
    if (currentHash !== entry.blobHash) notStaged.push({ path, state: "modified" });
  }

  const untracked = [...worktreeFiles].filter((path) => !indexEntries.has(path)).sort();

  const byPath = (a: GitStatusEntry, b: GitStatusEntry) => a.path.localeCompare(b.path);
  return { branch, staged: staged.sort(byPath), notStaged: notStaged.sort(byPath), untracked };
}

function hasUncommittedChanges(context: CommandContext, repoPath: string): boolean {
  const status = collectStatus(context, repoPath);
  return status.staged.length > 0 || status.notStaged.length > 0;
}

const STATE_LABEL: Record<GitStatusEntry["state"], string> = {
  new: "new file:  ",
  modified: "modified: ",
  deleted: "deleted:  ",
};

function handleInit(args: string[], context: CommandContext): CommandResult {
  const { positional } = parseArgs(args);
  const target = positional[0] ? resolveArgPath(context, positional[0]) : context.cwd;

  if (!context.vfs.exists(target)) context.vfs.mkdir(target, { recursive: true });
  const alreadyRepo = context.vfs.exists(joinPath(target, ".git"));
  initRepo(context.vfs, target);

  const verb = alreadyRepo ? "Reinitialized existing" : "Initialized empty";
  return ok(`${verb} Git repository in ${joinPath(target, ".git")}/\n`);
}

function handleStatus(context: CommandContext, repoPath: string): CommandResult {
  const status = collectStatus(context, repoPath);
  const sections = [`On branch ${status.branch}`];

  if (status.staged.length > 0) {
    sections.push("", "Changes to be committed:");
    sections.push(...status.staged.map((entry) => `\t${STATE_LABEL[entry.state]} ${entry.path}`));
  }
  if (status.notStaged.length > 0) {
    sections.push("", "Changes not staged for commit:");
    sections.push(...status.notStaged.map((entry) => `\t${STATE_LABEL[entry.state]} ${entry.path}`));
  }
  if (status.untracked.length > 0) {
    sections.push("", "Untracked files:");
    sections.push(...status.untracked.map((path) => `\t${path}`));
  }
  if (status.staged.length === 0 && status.notStaged.length === 0 && status.untracked.length === 0) {
    sections.push("", "nothing to commit, working tree clean");
  }

  return ok(`${sections.join("\n")}\n`);
}

/** `add`対象(ファイル/ディレクトリ、`.`を含む)をリポジトリルート相対パスの一覧に展開する。 */
function resolveAddTargets(context: CommandContext, repoPath: string, targets: string[]): string[] {
  const result = new Set<string>();
  for (const target of targets) {
    const abs = resolveArgPath(context, target);
    if (!context.vfs.exists(abs)) {
      throw new GitError(`pathspec '${target}' did not match any files`);
    }
    if (context.vfs.stat(abs).type === "directory") {
      const prefix = relativeToRepo(repoPath, abs);
      for (const path of listWorktreeFiles(context.vfs, repoPath, abs, prefix)) result.add(path);
    } else {
      result.add(relativeToRepo(repoPath, abs));
    }
  }
  return [...result];
}

function handleAdd(args: string[], context: CommandContext, repoPath: string): CommandResult {
  const { positional } = parseArgs(args);
  if (positional.length === 0) return fail("git add: nothing specified, nothing added.");

  let paths: string[];
  try {
    paths = resolveAddTargets(context, repoPath, positional);
  } catch (error) {
    if (error instanceof GitError) return fail(`git add: ${error.message}`);
    throw error;
  }

  let index = readIndex(context.vfs, repoPath);
  for (const path of paths) {
    const abs = joinPath(repoPath, path);
    const blobHash = writeObject(context.vfs, repoPath, { type: "blob", content: context.vfs.readFile(abs) });
    index = upsertIndexEntry(index, { path, mode: fileMode(context, abs), blobHash });
  }
  writeIndex(context.vfs, repoPath, index);
  return ok("");
}

function handleCommit(args: string[], context: CommandContext, repoPath: string): CommandResult {
  const { message } = extractMessageOption(args);
  if (!message) {
    return fail("git commit: option '-m' requires a message (an interactive editor is not supported)");
  }

  const branch = readHeadBranch(context.vfs, repoPath);
  const parentHash = readBranchHash(context.vfs, repoPath, branch);
  const parents = parentHash ? [parentHash] : [];

  const index = readIndex(context.vfs, repoPath);
  const treeHash = buildTreeFromIndex(context.vfs, repoPath, index);
  if (parentHash) {
    const parentCommit = readObject(context.vfs, repoPath, parentHash) as GitCommitObject;
    if (parentCommit.tree === treeHash) return fail("nothing to commit, working tree clean");
  }

  const { hash, commit } = createCommit(context.vfs, repoPath, treeHash, message, parents);
  writeBranchHash(context.vfs, repoPath, branch, hash);

  const label = parents.length === 0 ? `${branch} (root-commit)` : branch;
  return ok(`[${label} ${hash.slice(0, 7)}] ${commit.message.split("\n")[0]}\n`);
}

function handleLog(args: string[], context: CommandContext, repoPath: string): CommandResult {
  const { flags } = parseArgs(args);
  const oneline = flags.has("oneline");

  const branch = readHeadBranch(context.vfs, repoPath);
  const headHash = readBranchHash(context.vfs, repoPath, branch);
  if (!headHash) return fail(`fatal: your current branch '${branch}' does not have any commits yet`);

  const commits = [...collectAncestors(context.vfs, repoPath, headHash)]
    .map((hash) => ({ hash, commit: readObject(context.vfs, repoPath, hash) as GitCommitObject }))
    .sort((a, b) => b.commit.sequence - a.commit.sequence);

  const stdout = oneline
    ? commits.map(({ hash, commit }) => `${hash.slice(0, 7)} ${commit.message.split("\n")[0]}`).join("\n")
    : commits
        .map(
          ({ hash, commit }) =>
            `commit ${hash}\nAuthor: ${commit.author}\nDate:   ${formatCommitDate(commit.sequence)}\n\n    ${commit.message}\n`,
        )
        .join("\n");

  return ok(`${stdout}\n`);
}

function handleBranch(args: string[], context: CommandContext, repoPath: string): CommandResult {
  const { positional } = parseArgs(args);
  if (positional.length === 0) {
    const current = readHeadBranch(context.vfs, repoPath);
    const lines = listBranches(context.vfs, repoPath).map((name) => (name === current ? `* ${name}` : `  ${name}`));
    return ok(lines.length > 0 ? `${lines.join("\n")}\n` : "");
  }

  const [name] = positional;
  if (branchExists(context.vfs, repoPath, name)) return fail(`fatal: a branch named '${name}' already exists`);

  const currentBranch = readHeadBranch(context.vfs, repoPath);
  const headHash = readBranchHash(context.vfs, repoPath, currentBranch);
  if (!headHash) return fail(`fatal: not a valid object name: '${currentBranch}'`);

  writeBranchHash(context.vfs, repoPath, name, headHash);
  return ok("");
}

function switchWorktreeToBranch(context: CommandContext, repoPath: string, branch: string): void {
  const hash = readBranchHash(context.vfs, repoPath, branch);
  const tree = hash ? (readObject(context.vfs, repoPath, hash) as GitCommitObject).tree : undefined;
  writeHeadBranch(context.vfs, repoPath, branch);
  writeIndex(context.vfs, repoPath, flattenTree(context.vfs, repoPath, tree));
  materializeTree(context.vfs, repoPath, tree);
}

function handleCheckout(
  args: string[],
  context: CommandContext,
  repoPath: string,
  commandName: "checkout" | "switch",
): CommandResult {
  const { flags, positional } = parseArgs(args);
  const createFlag = commandName === "switch" ? flags.has("c") : flags.has("b");
  if (positional.length === 0) return fail(`git ${commandName}: missing branch name`);
  const [name] = positional;

  if (hasUncommittedChanges(context, repoPath)) {
    return fail(
      "error: your local changes would be overwritten; commit or stage your changes before switching branches.",
    );
  }

  if (createFlag) {
    if (branchExists(context.vfs, repoPath, name)) return fail(`fatal: a branch named '${name}' already exists`);
    const currentBranch = readHeadBranch(context.vfs, repoPath);
    const headHash = readBranchHash(context.vfs, repoPath, currentBranch);
    if (!headHash) return fail(`fatal: not a valid object name: '${currentBranch}'`);
    writeBranchHash(context.vfs, repoPath, name, headHash);
  } else if (!branchExists(context.vfs, repoPath, name)) {
    return fail(`error: pathspec '${name}' did not match any file(s) known to git`);
  }

  switchWorktreeToBranch(context, repoPath, name);
  return ok(`Switched to ${createFlag ? "a new branch" : "branch"} '${name}'\n`);
}

/** `performMerge`の結果をGit風の文言へ変換する(design 7章)。`git merge`/`git pull`で共用する。 */
function formatMergeOutcome(outcome: MergeOutcome, currentHash: string, prefix = ""): CommandResult {
  switch (outcome.type) {
    case "up-to-date":
      return ok(`${prefix}Already up to date.\n`);
    case "fast-forward":
      return ok(`${prefix}Updating ${currentHash.slice(0, 7)}..${outcome.commitHash.slice(0, 7)}\nFast-forward\n`);
    case "merged":
      return ok(`${prefix}Merge made by the 'recursive' strategy.\n`);
    case "conflict":
      return {
        stdout: "",
        stderr: prefix + outcome.paths.map((path) => `CONFLICT (content): Merge conflict in ${path}\n`).join(""),
        exitCode: 1,
      };
  }
}

function handleMerge(args: string[], context: CommandContext, repoPath: string): CommandResult {
  const { positional } = parseArgs(args);
  if (positional.length === 0) return fail("git merge: missing branch name");
  const [otherBranch] = positional;

  if (!branchExists(context.vfs, repoPath, otherBranch)) {
    return fail(`merge: ${otherBranch} - not something we can merge`);
  }
  if (hasUncommittedChanges(context, repoPath)) {
    return fail("error: your local changes would be overwritten by merge; commit your changes before merging.");
  }

  const branch = readHeadBranch(context.vfs, repoPath);
  const currentHash = readBranchHash(context.vfs, repoPath, branch);
  const otherHash = readBranchHash(context.vfs, repoPath, otherBranch);
  if (!currentHash || !otherHash) {
    return fail("fatal: both branches must have at least one commit to merge");
  }

  const message = `Merge branch '${otherBranch}' into ${branch}`;
  const outcome = performMerge(context.vfs, repoPath, branch, currentHash, otherHash, message);
  return formatMergeOutcome(outcome, currentHash);
}

/** `git remote add`で設定した`<name>`の登録先パスを解決する。未設定/リポジトリ不在ならエラー。 */
function resolveRemotePath(context: CommandContext, repoPath: string, remoteName: string): string {
  const url = getRemoteUrl(context.vfs, repoPath, remoteName);
  if (!url || !context.vfs.exists(gitDir(url))) {
    throw new GitError(`'${remoteName}' does not appear to be a git repository`);
  }
  return url;
}

function handleRemote(args: string[], context: CommandContext, repoPath: string): CommandResult {
  const { flags, positional } = parseArgs(args);

  if (positional[0] === "add") {
    const [, name, target] = positional;
    if (!name || !target) return fail("usage: git remote add <name> <url>");
    setRemoteUrl(context.vfs, repoPath, name, resolveArgPath(context, target));
    return ok("");
  }

  const config = readConfig(context.vfs, repoPath);
  const names = Object.keys(config.remotes).sort();
  if (flags.has("v") || flags.has("verbose")) {
    const lines = names.flatMap((name) => [
      `${name}\t${config.remotes[name]} (fetch)`,
      `${name}\t${config.remotes[name]} (push)`,
    ]);
    return ok(lines.length > 0 ? `${lines.join("\n")}\n` : "");
  }
  return ok(names.length > 0 ? `${names.join("\n")}\n` : "");
}

function handlePush(args: string[], context: CommandContext, repoPath: string): CommandResult {
  const { positional } = parseArgs(args);
  const remoteName = positional[0] ?? "origin";
  const branch = positional[1] ?? readHeadBranch(context.vfs, repoPath);

  let remotePath: string;
  try {
    remotePath = resolveRemotePath(context, repoPath, remoteName);
  } catch (error) {
    if (error instanceof GitError) return fail(`fatal: ${error.message}`);
    throw error;
  }

  const outcome = pushBranch(context.vfs, repoPath, remotePath, branch);
  switch (outcome.type) {
    case "up-to-date":
      return ok("Everything up-to-date\n");
    case "rejected":
      return {
        stdout: "",
        stderr:
          `To ${remotePath}\n` +
          ` ! [rejected]        ${branch} -> ${branch} (non-fast-forward)\n` +
          `error: failed to push some refs to '${remotePath}'\n`,
        exitCode: 1,
      };
    case "ok":
      return ok(`To ${remotePath}\n   ${branch} -> ${branch}\n`);
  }
}

function handlePull(args: string[], context: CommandContext, repoPath: string): CommandResult {
  const { positional } = parseArgs(args);
  const remoteName = positional[0] ?? "origin";
  const branch = positional[1] ?? readHeadBranch(context.vfs, repoPath);

  let remotePath: string;
  try {
    remotePath = resolveRemotePath(context, repoPath, remoteName);
  } catch (error) {
    if (error instanceof GitError) return fail(`fatal: ${error.message}`);
    throw error;
  }
  if (hasUncommittedChanges(context, repoPath)) {
    return fail("error: your local changes would be overwritten by merge; commit your changes before merging.");
  }

  const fetchedHash = fetchBranch(context.vfs, repoPath, remotePath, remoteName, branch);
  if (!fetchedHash) return fail(`fatal: couldn't find remote ref ${branch}`);

  const prefix = `From ${remotePath}\n`;
  const currentBranch = readHeadBranch(context.vfs, repoPath);
  const currentHash = readBranchHash(context.vfs, repoPath, currentBranch);

  if (!currentHash) {
    writeBranchHash(context.vfs, repoPath, currentBranch, fetchedHash);
    const commit = readObject(context.vfs, repoPath, fetchedHash) as GitCommitObject;
    writeIndex(context.vfs, repoPath, flattenTree(context.vfs, repoPath, commit.tree));
    materializeTree(context.vfs, repoPath, commit.tree);
    return ok(`${prefix}Fast-forward\n`);
  }

  const message = `Merge remote-tracking branch '${remoteName}/${branch}'`;
  const outcome = performMerge(context.vfs, repoPath, currentBranch, currentHash, fetchedHash, message);
  return formatMergeOutcome(outcome, currentHash, prefix);
}

/**
 * `git <subcommand> [<args>]`。design 2章の方針により専用のモード遷移状態機械は持たず、
 * 他のcoreutils風コマンドと同じ`CommandHandler`として実装する。ドメインロジックは
 * `src/engine/git/`が提供し、ここはそれを`CommandResult`へ変換する薄いアダプタ(design 11章)。
 */
export const gitCommand: CommandHandler = (args, context) => {
  const [subcommand, ...rest] = args;
  if (!subcommand) return fail("usage: git <command> [<args>]");

  if (subcommand === "init") return handleInit(rest, context);

  const repoPath = findRepoRoot(context.vfs, context.cwd);
  if (!repoPath) return fail("fatal: not a git repository (or any of the parent directories): .git");

  try {
    switch (subcommand) {
      case "status":
        return handleStatus(context, repoPath);
      case "add":
        return handleAdd(rest, context, repoPath);
      case "commit":
        return handleCommit(rest, context, repoPath);
      case "log":
        return handleLog(rest, context, repoPath);
      case "branch":
        return handleBranch(rest, context, repoPath);
      case "checkout":
        return handleCheckout(rest, context, repoPath, "checkout");
      case "switch":
        return handleCheckout(rest, context, repoPath, "switch");
      case "merge":
        return handleMerge(rest, context, repoPath);
      case "remote":
        return handleRemote(rest, context, repoPath);
      case "push":
        return handlePush(rest, context, repoPath);
      case "pull":
        return handlePull(rest, context, repoPath);
      default:
        throw new GitUnsupportedCommandError(subcommand);
    }
  } catch (error) {
    if (error instanceof GitError || error instanceof VfsError) {
      return fail(`git: ${error.message}`);
    }
    throw error;
  }
};
