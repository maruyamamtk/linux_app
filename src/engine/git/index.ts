export * from "./types";
export { GitError, GitUnsupportedCommandError } from "./errors";
export { hashObject } from "./hash";
export { GIT_DIR, gitDir, findRepoRoot, initRepo } from "./repo";
export { writeObject, readObject, objectExists } from "./objectStore";
export {
  readHeadBranch,
  writeHeadBranch,
  readBranchHash,
  writeBranchHash,
  branchExists,
  listBranches,
  readRemoteBranchHash,
  writeRemoteBranchHash,
} from "./refs";
export { readIndex, writeIndex, upsertIndexEntry, removeIndexEntry } from "./indexFile";
export { buildTreeFromIndex, flattenTree, listWorktreeFiles, materializeTree } from "./tree";
export {
  authorFromUser,
  nextSequence,
  createCommit,
  collectAncestors,
  isAncestor,
  findMergeBase,
} from "./commit";
export type { CreateCommitResult } from "./commit";
export { performMerge } from "./merge";
export type { MergeOutcome } from "./merge";
export { formatCommitDate } from "./date";
export { readConfig, writeConfig, getRemoteUrl, setRemoteUrl } from "./config";
export { pushBranch, fetchBranch } from "./remote";
export type { PushOutcome } from "./remote";
