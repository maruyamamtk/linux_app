import { findPackage } from "./repository";
import type { PackageDefinition } from "./types";

export interface InstallPlan {
  /** リポジトリに存在しない、指定されたパッケージ名。 */
  missing: string[];
  /** 既にインストール済みだった、指定されたパッケージ名。 */
  alreadyInstalled: string[];
  /** 新規にインストールする、指定されたパッケージ本体(依存関係は含まない)。 */
  requested: PackageDefinition[];
  /** `requested`を満たすために追加でインストールする依存パッケージ(依存が深い順)。 */
  dependencies: PackageDefinition[];
}

/**
 * `install`対象を解決する。依存関係は深さ優先で辿り、インストール済み/他の依存として
 * 解決済みのパッケージは重複させない(design: `git merge`の祖先探索と同様に単純な再帰で十分)。
 */
export function planInstall(names: readonly string[], installed: ReadonlySet<string>): InstallPlan {
  const missing: string[] = [];
  const alreadyInstalled: string[] = [];
  const requested: PackageDefinition[] = [];
  const dependencies: PackageDefinition[] = [];
  const seen = new Set<string>();

  function collectDependencies(pkg: PackageDefinition): void {
    for (const depName of pkg.dependencies) {
      if (seen.has(depName) || installed.has(depName)) continue;
      const dep = findPackage(depName);
      if (!dep) continue;
      seen.add(depName);
      collectDependencies(dep);
      dependencies.push(dep);
    }
  }

  for (const name of names) {
    const pkg = findPackage(name);
    if (!pkg) {
      missing.push(name);
      continue;
    }
    if (seen.has(name)) continue;
    if (installed.has(name)) {
      alreadyInstalled.push(name);
      continue;
    }
    seen.add(name);
    collectDependencies(pkg);
    requested.push(pkg);
  }

  return { missing, alreadyInstalled, requested, dependencies };
}
