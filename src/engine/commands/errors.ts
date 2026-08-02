import { VfsError, type VfsErrorCode } from "../vfs";
import type { CommandResult } from "./types";

const VFS_ERROR_MESSAGES: Record<VfsErrorCode, string> = {
  ENOENT: "No such file or directory",
  EEXIST: "File exists",
  ENOTDIR: "Not a directory",
  EISDIR: "Is a directory",
  EACCES: "Permission denied",
  ENOTEMPTY: "Directory not empty",
  EINVAL: "Invalid argument",
};

/** `cp: cannot stat 'x': No such file or directory` のようなcoreutils風のエラー文を組み立てる。 */
export function describeVfsError(
  command: string,
  target: string,
  error: unknown,
  verb = "cannot access",
): string {
  if (error instanceof VfsError) {
    return `${command}: ${verb} '${target}': ${VFS_ERROR_MESSAGES[error.code]}`;
  }
  throw error;
}

export function ok(stdout: string): CommandResult {
  return { stdout, stderr: "", exitCode: 0 };
}

export function fail(stderr: string, exitCode = 1): CommandResult {
  return { stdout: "", stderr, exitCode };
}
