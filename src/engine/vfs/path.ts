/**
 * パスを絶対パスに正規化する。相対パスはbaseを基準に解決し、"."・".."・連続するスラッシュを解消する。
 */
export function normalizePath(path: string, base = "/"): string {
  const absolute = path.startsWith("/") ? path : `${base.replace(/\/+$/, "")}/${path}`;
  const segments = absolute.split("/").filter((segment) => segment.length > 0);
  const resolved: string[] = [];

  for (const segment of segments) {
    if (segment === ".") continue;
    if (segment === "..") {
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }

  return `/${resolved.join("/")}`;
}

export function splitPath(path: string): string[] {
  return normalizePath(path)
    .split("/")
    .filter((segment) => segment.length > 0);
}

export function dirname(path: string): string {
  const segments = splitPath(path);
  segments.pop();
  return `/${segments.join("/")}`;
}

export function basename(path: string): string {
  const segments = splitPath(path);
  return segments[segments.length - 1] ?? "";
}

export function joinPath(...parts: string[]): string {
  return normalizePath(parts.join("/"));
}
