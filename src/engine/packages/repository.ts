import type { PackageDefinition } from "./types";

/**
 * Ch20(パッケージ管理)演習用の固定の仮想パッケージリポジトリ。実ネットワーク通信は行わず、
 * `dnf`/`apt`コマンドはこの一覧に対してのみ`search`/`info`/`install`を実行する(docs/requirements.md 3章2節)。
 * 依存パッケージ(`libcurl4`, `python3-libs`, `containerd`, `mysql-common`)を含めることで、
 * `install`時の依存関係解決を演習できるようにしている。
 */
export const PACKAGE_REPOSITORY: readonly PackageDefinition[] = [
  {
    name: "nginx",
    version: "1.24.0",
    sizeKb: 570,
    summary: "軽量で高性能なWebサーバー/リバースプロキシ",
    dependencies: [],
  },
  {
    name: "curl",
    version: "8.4.0",
    sizeKb: 187,
    summary: "コマンドラインで動作するデータ転送クライアント",
    dependencies: ["libcurl4"],
  },
  {
    name: "libcurl4",
    version: "8.4.0",
    sizeKb: 382,
    summary: "curlが利用する共有ライブラリ",
    dependencies: [],
  },
  {
    name: "wget",
    version: "1.21.4",
    sizeKb: 936,
    summary: "コマンドラインファイルダウンローダー",
    dependencies: [],
  },
  {
    name: "htop",
    version: "3.2.2",
    sizeKb: 158,
    summary: "対話型のプロセスビューア",
    dependencies: [],
  },
  {
    name: "tmux",
    version: "3.3a",
    sizeKb: 429,
    summary: "ターミナルマルチプレクサ",
    dependencies: [],
  },
  {
    name: "tree",
    version: "2.1.1",
    sizeKb: 47,
    summary: "ディレクトリ構造をツリー表示するコマンド",
    dependencies: [],
  },
  {
    name: "jq",
    version: "1.7",
    sizeKb: 213,
    summary: "コマンドラインで動作するJSONプロセッサ",
    dependencies: [],
  },
  {
    name: "python3",
    version: "3.11.6",
    sizeKb: 27500,
    summary: "Pythonプログラミング言語のインタプリタ",
    dependencies: ["python3-libs"],
  },
  {
    name: "python3-libs",
    version: "3.11.6",
    sizeKb: 21300,
    summary: "python3が利用する標準ライブラリ",
    dependencies: [],
  },
  {
    name: "nodejs",
    version: "20.9.0",
    sizeKb: 33200,
    summary: "JavaScriptランタイム",
    dependencies: [],
  },
  {
    name: "docker-ce",
    version: "24.0.7",
    sizeKb: 76400,
    summary: "コンテナ実行エンジン",
    dependencies: ["containerd"],
  },
  {
    name: "containerd",
    version: "1.6.24",
    sizeKb: 29800,
    summary: "コンテナランタイム",
    dependencies: [],
  },
  {
    name: "mysql-server",
    version: "8.0.35",
    sizeKb: 40200,
    summary: "MySQLデータベースサーバー",
    dependencies: ["mysql-common"],
  },
  {
    name: "mysql-common",
    version: "8.0.35",
    sizeKb: 620,
    summary: "MySQL関連パッケージ共通ファイル",
    dependencies: [],
  },
  {
    name: "redis-server",
    version: "7.2.3",
    sizeKb: 2100,
    summary: "インメモリKVSサーバー",
    dependencies: [],
  },
] as const;

export function findPackage(name: string): PackageDefinition | undefined {
  return PACKAGE_REPOSITORY.find((pkg) => pkg.name === name);
}

/** パッケージ名・説明の両方に対し、与えられた語すべてを含むパッケージを名前順で返す(`dnf`/`apt search`)。 */
export function searchPackages(terms: readonly string[]): PackageDefinition[] {
  const needles = terms.map((term) => term.toLowerCase()).filter((term) => term.length > 0);
  if (needles.length === 0) return [];

  return PACKAGE_REPOSITORY.filter((pkg) => {
    const haystack = `${pkg.name} ${pkg.summary}`.toLowerCase();
    return needles.every((needle) => haystack.includes(needle));
  }).sort((a, b) => a.name.localeCompare(b.name));
}
