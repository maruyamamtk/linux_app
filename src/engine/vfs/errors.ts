export type VfsErrorCode =
  | "ENOENT"
  | "EEXIST"
  | "ENOTDIR"
  | "EISDIR"
  | "EACCES"
  | "ENOTEMPTY"
  | "EINVAL";

export class VfsError extends Error {
  readonly code: VfsErrorCode;
  readonly path: string;

  constructor(code: VfsErrorCode, path: string, message?: string) {
    super(message ?? `${code}: ${path}`);
    this.name = "VfsError";
    this.code = code;
    this.path = path;
  }
}
