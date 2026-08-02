import { joinPath, normalizePath, type VfsStat, type VfsUser } from "../vfs";
import { parseArgs } from "./args";
import { fail, ok } from "./errors";
import type { CommandContext, CommandHandler } from "./types";

function resolveArgPath(context: CommandContext, path: string): string {
  return normalizePath(path, context.cwd);
}

/** シェルのグロブ(`*`・`?`)のみに対応した簡易マッチャ。`-name` の判定に使う。 */
function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}

interface FindOptions {
  path: string;
  name?: string;
  type?: "f" | "d";
}

function parseFindArgs(args: string[]): FindOptions {
  const options: FindOptions = { path: "." };
  let sawPath = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "-name") {
      options.name = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === "-type") {
      const value = args[i + 1];
      if (value === "f" || value === "d") options.type = value;
      i += 1;
      continue;
    }
    if (!sawPath && !arg.startsWith("-")) {
      options.path = arg;
      sawPath = true;
    }
  }

  return options;
}

export const findCommand: CommandHandler = (args, context) => {
  const options = parseFindArgs(args);
  const resolvedStart = resolveArgPath(context, options.path);
  if (!context.vfs.exists(resolvedStart)) {
    return fail(`find: '${options.path}': No such file or directory`);
  }

  const nameRegExp = options.name ? globToRegExp(options.name) : undefined;
  const lines: string[] = [];
  const errors: string[] = [];

  const visit = (path: string): void => {
    let stat: VfsStat;
    try {
      stat = context.vfs.stat(path);
    } catch {
      errors.push(`find: '${path}': Permission denied`);
      return;
    }

    const matchesType = !options.type || stat.type === (options.type === "f" ? "file" : "directory");
    const matchesName = !nameRegExp || nameRegExp.test(stat.name);
    if (matchesType && matchesName) lines.push(path);

    if (stat.type === "directory") {
      try {
        for (const entry of context.vfs.readdir(path)) visit(entry.path);
      } catch {
        errors.push(`find: '${path}': Permission denied`);
      }
    }
  };

  visit(resolvedStart);

  return {
    stdout: lines.length > 0 ? `${lines.join("\n")}\n` : "",
    stderr: errors.length > 0 ? `${errors.join("\n")}\n` : "",
    exitCode: errors.length > 0 ? 1 : 0,
  };
};

/**
 * 実際のlocateはあらかじめ収集されたファイル一覧データベース(updatedbが生成)を
 * 検索するが、本シミュレータではDBを持たないためVFS全体をその場で走査して代用する。
 */
export const locateCommand: CommandHandler = (args, context) => {
  const { positional } = parseArgs(args);
  if (positional.length === 0) return fail("locate: missing pattern");
  const pattern = positional[0];
  const lines: string[] = [];

  const visit = (path: string): void => {
    if (path.includes(pattern)) lines.push(path);

    let stat: VfsStat;
    try {
      stat = context.vfs.stat(path);
    } catch {
      return;
    }

    if (stat.type === "directory") {
      try {
        for (const entry of context.vfs.readdir(path)) visit(entry.path);
      } catch {
        // 読み取り権限のないディレクトリは黙ってスキップする(実際のlocateもDB作成時点の権限に依存する)
      }
    }
  };

  visit("/");

  return {
    stdout: lines.length > 0 ? `${lines.join("\n")}\n` : "",
    stderr: "",
    exitCode: lines.length > 0 ? 0 : 1,
  };
};

/** `hasPermission` (vfs/permissions.ts) のexecuteビット判定をVfsStat向けに再実装したもの。 */
function isExecutableByUser(stat: VfsStat, user: VfsUser): boolean {
  if (user.isRoot) return true;
  if (stat.owner === user.name) return ((stat.mode >> 6) & 0b001) === 0b001;
  if (user.groups.includes(stat.group)) return ((stat.mode >> 3) & 0b001) === 0b001;
  return (stat.mode & 0b001) === 0b001;
}

export const whichCommand: CommandHandler = (args, context) => {
  const { positional } = parseArgs(args);
  if (positional.length === 0) return fail("which: missing operand");

  const pathDirs = (context.env.PATH ?? "/usr/bin:/bin").split(":").filter((dir) => dir.length > 0);
  const user = context.vfs.getUser();
  const lines: string[] = [];
  let missingCount = 0;

  for (const name of positional) {
    const found = pathDirs
      .map((dir) => joinPath(dir, name))
      .find((candidate) => {
        if (!context.vfs.exists(candidate)) return false;
        const stat = context.vfs.stat(candidate);
        return stat.type === "file" && isExecutableByUser(stat, user);
      });
    if (found) {
      lines.push(found);
    } else {
      missingCount += 1;
    }
  }

  return {
    stdout: lines.length > 0 ? `${lines.join("\n")}\n` : "",
    stderr: "",
    exitCode: missingCount > 0 ? 1 : 0,
  };
};

interface ManPage {
  summary: string;
  body: string;
}

const MAN_PAGES: Record<string, ManPage> = {
  pwd: {
    summary: "現在の作業ディレクトリの絶対パスを表示する",
    body: "NAME\n    pwd - 現在の作業ディレクトリを表示する\n\nSYNOPSIS\n    pwd\n\nDESCRIPTION\n    カレントディレクトリの絶対パスを標準出力に表示します。",
  },
  cd: {
    summary: "カレントディレクトリを変更する",
    body: "NAME\n    cd - カレントディレクトリを変更する\n\nSYNOPSIS\n    cd [ディレクトリ]\n\nDESCRIPTION\n    カレントディレクトリを指定したディレクトリに変更します。引数を省略すると\n    ホームディレクトリに移動します。",
  },
  ls: {
    summary: "ディレクトリの内容やファイル情報を一覧表示する",
    body: "NAME\n    ls - ディレクトリの内容を一覧表示する\n\nSYNOPSIS\n    ls [-a] [-l] [ファイル/ディレクトリ...]\n\nDESCRIPTION\n    指定したディレクトリの内容(省略時はカレントディレクトリ)を一覧表示します。\n    -a  「.」で始まる隠しファイルも表示する\n    -l  パーミッション・所有者・サイズ等を含む詳細形式で表示する",
  },
  mkdir: {
    summary: "新しいディレクトリを作成する",
    body: "NAME\n    mkdir - ディレクトリを作成する\n\nSYNOPSIS\n    mkdir [-p] ディレクトリ...\n\nDESCRIPTION\n    指定した名前のディレクトリを新規作成します。\n    -p  存在しない親ディレクトリもまとめて作成する",
  },
  touch: {
    summary: "空のファイルを作成する、または既存ファイルの更新時刻を更新する",
    body: "NAME\n    touch - ファイルの作成・更新時刻の更新を行う\n\nSYNOPSIS\n    touch ファイル...\n\nDESCRIPTION\n    指定したファイルが存在しない場合は空のファイルとして作成します。\n    既に存在する場合は更新時刻の更新に相当する操作を行います。",
  },
  rm: {
    summary: "ファイルやディレクトリを削除する",
    body: "NAME\n    rm - ファイルを削除する\n\nSYNOPSIS\n    rm [-r] [-f] ファイル...\n\nDESCRIPTION\n    指定したファイルを削除します。\n    -r  ディレクトリを再帰的に削除する\n    -f  存在しないファイルのエラーを無視する",
  },
  rmdir: {
    summary: "空のディレクトリを削除する",
    body: "NAME\n    rmdir - 空のディレクトリを削除する\n\nSYNOPSIS\n    rmdir ディレクトリ...\n\nDESCRIPTION\n    指定したディレクトリが空である場合のみ削除します。中身がある場合はrm -rを使用してください。",
  },
  cp: {
    summary: "ファイルやディレクトリをコピーする",
    body: "NAME\n    cp - ファイルをコピーする\n\nSYNOPSIS\n    cp [-r] コピー元... コピー先\n\nDESCRIPTION\n    コピー元をコピー先へ複製します。\n    -r  ディレクトリを再帰的にコピーする",
  },
  mv: {
    summary: "ファイルやディレクトリを移動・改名する",
    body: "NAME\n    mv - ファイルを移動・改名する\n\nSYNOPSIS\n    mv 移動元... 移動先\n\nDESCRIPTION\n    移動元を移動先へ移動します。同じディレクトリ内であれば改名として扱われます。",
  },
  ln: {
    summary: "ファイルへのリンクを作成する",
    body: "NAME\n    ln - ファイルのリンクを作成する\n\nSYNOPSIS\n    ln [-s] リンク元 リンク先\n\nDESCRIPTION\n    リンク元へのリンクをリンク先に作成します。\n    -s  シンボリックリンクを作成する(省略時はハードリンク)",
  },
  find: {
    summary: "ディレクトリツリーを再帰的に探索してファイルを検索する",
    body: "NAME\n    find - ファイルを探索する\n\nSYNOPSIS\n    find [パス] [-name パターン] [-type f|d]\n\nDESCRIPTION\n    指定したパス(省略時はカレントディレクトリ)以下を再帰的に探索し、\n    条件に一致するファイル/ディレクトリのパスを表示します。",
  },
  locate: {
    summary: "あらかじめ収集されたパス一覧からファイル名を検索する",
    body: "NAME\n    locate - ファイル名からパスを検索する\n\nSYNOPSIS\n    locate パターン\n\nDESCRIPTION\n    ファイルシステム全体からパターンを含むパスを検索します。",
  },
  which: {
    summary: "PATH上から実行可能なコマンドの場所を検索する",
    body: "NAME\n    which - コマンドの実体を検索する\n\nSYNOPSIS\n    which コマンド名...\n\nDESCRIPTION\n    環境変数PATHに列挙されたディレクトリを順に探索し、実行可能なコマンドの\n    パスを表示します。",
  },
  grep: {
    summary: "ファイルの内容を正規表現で検索する",
    body: "NAME\n    grep - パターンにマッチする行を検索する\n\nSYNOPSIS\n    grep [-i] [-n] [-v] [-E] パターン ファイル...\n\nDESCRIPTION\n    指定したファイルから正規表現パターンにマッチする行を表示します。\n    -i  大文字小文字を区別しない\n    -n  マッチした行の行番号を表示する\n    -v  マッチしなかった行を表示する(反転)\n    -E  拡張正規表現(+ ? {m,n} () |)を使用する",
  },
  man: {
    summary: "コマンドのマニュアルページを表示する",
    body: "NAME\n    man - マニュアルページを表示する\n\nSYNOPSIS\n    man コマンド名\n\nDESCRIPTION\n    指定したコマンドのマニュアルページを表示します。",
  },
  help: {
    summary: "利用可能な組み込みコマンドの一覧を表示する",
    body: "NAME\n    help - 組み込みコマンドの一覧を表示する\n\nSYNOPSIS\n    help\n\nDESCRIPTION\n    このアプリで利用できる組み込みコマンドとその概要を一覧表示します。",
  },
};

export const manCommand: CommandHandler = (args, _context) => {
  const { positional } = parseArgs(args);
  if (positional.length === 0) return fail("man: missing operand");
  const name = positional[0];
  const page = MAN_PAGES[name];
  if (!page) return fail(`No manual entry for ${name}`, 1);
  return ok(`${page.body}\n`);
};

export const helpCommand: CommandHandler = (_args, _context) => {
  const lines = Object.keys(MAN_PAGES)
    .sort()
    .map((name) => `  ${name.padEnd(8)} ${MAN_PAGES[name].summary}`);
  return ok(`利用可能なコマンド:\n${lines.join("\n")}\n`);
};
