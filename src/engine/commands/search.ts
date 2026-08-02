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
  wc: {
    summary: "行数・単語数・バイト数を数える",
    body: "NAME\n    wc - 行数・単語数・バイト数を数える\n\nSYNOPSIS\n    wc [-l] [-w] [-c] [ファイル...]\n\nDESCRIPTION\n    指定したファイル(省略時は標準入力)の行数・単語数・バイト数を表示します。\n    -l  行数のみ表示する\n    -w  単語数のみ表示する\n    -c  バイト数のみ表示する",
  },
  sort: {
    summary: "テキストの行を並び替える",
    body: "NAME\n    sort - 行を並び替える\n\nSYNOPSIS\n    sort [-n] [-r] [-u] [-k フィールド番号] [ファイル...]\n\nDESCRIPTION\n    指定したファイル(省略時は標準入力)の各行を並び替えて表示します。\n    -n  数値として比較する\n    -r  逆順に並び替える\n    -u  重複する行をまとめる\n    -k  指定したフィールド番号を比較キーにする",
  },
  uniq: {
    summary: "隣接する重複行をまとめる",
    body: "NAME\n    uniq - 隣接する重複行をまとめる\n\nSYNOPSIS\n    uniq [-c] [ファイル]\n\nDESCRIPTION\n    連続して同じ内容の行をひとつにまとめて表示します(sortしていない入力では\n    離れた場所にある重複行はまとめられません)。\n    -c  各行の前に出現回数を表示する",
  },
  cut: {
    summary: "各行から指定したフィールドを切り出す",
    body: "NAME\n    cut - 各行からフィールドを切り出す\n\nSYNOPSIS\n    cut -f フィールドリスト [-d 区切り文字] [ファイル...]\n\nDESCRIPTION\n    指定した区切り文字(省略時はタブ)で各行を分割し、指定したフィールドのみを\n    表示します。フィールドリストは `1,3` や `2-4` のように指定できます。",
  },
  tr: {
    summary: "標準入力の文字を変換・削除する",
    body: "NAME\n    tr - 文字を変換・削除する\n\nSYNOPSIS\n    tr SET1 SET2\n    tr -d SET1\n\nDESCRIPTION\n    標準入力に含まれるSET1の文字をSET2の対応する文字に変換して表示します。\n    -d  SET1に含まれる文字を削除する\n    SET1・SET2は `a-z` のような範囲指定にも対応します。",
  },
  head: {
    summary: "ファイルの先頭部分を表示する",
    body: "NAME\n    head - ファイルの先頭部分を表示する\n\nSYNOPSIS\n    head [-n 行数] [ファイル...]\n\nDESCRIPTION\n    指定したファイル(省略時は標準入力)の先頭から指定行数(省略時は10行)を\n    表示します。",
  },
  tail: {
    summary: "ファイルの末尾部分を表示する",
    body: "NAME\n    tail - ファイルの末尾部分を表示する\n\nSYNOPSIS\n    tail [-n 行数] [-f] [ファイル...]\n\nDESCRIPTION\n    指定したファイル(省略時は標準入力)の末尾から指定行数(省略時は10行)を\n    表示します。\n    -f  ファイルへの追記を監視し続ける(本アプリでは実行時点の末尾を返す簡易的な\n        シミュレートのみ行う)",
  },
  diff: {
    summary: "2つのファイルの差分を表示する",
    body: "NAME\n    diff - 2つのファイルを比較する\n\nSYNOPSIS\n    diff ファイル1 ファイル2\n    diff -u ファイル1 ファイル2\n\nDESCRIPTION\n    2つのファイルを行単位で比較し、差分を表示します。\n    -u  ユニファイド形式(前後の文脈付き)で表示する",
  },
  help: {
    summary: "利用可能な組み込みコマンドの一覧を表示する",
    body: "NAME\n    help - 組み込みコマンドの一覧を表示する\n\nSYNOPSIS\n    help\n\nDESCRIPTION\n    このアプリで利用できる組み込みコマンドとその概要を一覧表示します。",
  },
  chmod: {
    summary: "ファイルやディレクトリのパーミッションを変更する",
    body: "NAME\n    chmod - パーミッションを変更する\n\nSYNOPSIS\n    chmod モード ファイル...\n\nDESCRIPTION\n    指定したファイルのパーミッションを変更します。\n    モードには755のような数値モード、u+x/go-w/a=rxのようなシンボリックモードを指定できます。",
  },
  su: {
    summary: "実行ユーザーを切り替える",
    body: "NAME\n    su - ユーザーを切り替える\n\nSYNOPSIS\n    su [ユーザー名]\n\nDESCRIPTION\n    以後のコマンドを指定したユーザー(省略時はroot)として実行するように切り替えます。\n    本アプリでは演習用の仮想的な権限昇格として認証なしで切り替わります。",
  },
  sudo: {
    summary: "1つのコマンドをroot権限で実行する",
    body: "NAME\n    sudo - コマンドをroot権限で実行する\n\nSYNOPSIS\n    sudo コマンド [引数...]\n\nDESCRIPTION\n    指定したコマンドのみをroot権限で実行し、実行後は元のユーザーに戻ります。",
  },
  ps: {
    summary: "実行中のプロセス一覧を表示する",
    body: "NAME\n    ps - プロセス一覧を表示する\n\nSYNOPSIS\n    ps [-e|-a|-A]\n\nDESCRIPTION\n    モックのプロセス一覧を表示します。オプション省略時は自分が所有するプロセスのみ、\n    -e/-a/-A指定時は全ユーザーのプロセスを表示します。",
  },
  jobs: {
    summary: "現在のシェルのジョブ一覧を表示する",
    body: "NAME\n    jobs - ジョブ一覧を表示する\n\nSYNOPSIS\n    jobs\n\nDESCRIPTION\n    バックグラウンド/停止中のジョブを番号付きで一覧表示します。",
  },
  fg: {
    summary: "ジョブをフォアグラウンドに戻す",
    body: "NAME\n    fg - ジョブをフォアグラウンドに戻す\n\nSYNOPSIS\n    fg [%ジョブ番号]\n\nDESCRIPTION\n    指定したジョブ(省略時はカレントジョブ)をフォアグラウンドで再開します。",
  },
  bg: {
    summary: "停止中のジョブをバックグラウンドで再開する",
    body: "NAME\n    bg - ジョブをバックグラウンドで再開する\n\nSYNOPSIS\n    bg [%ジョブ番号]\n\nDESCRIPTION\n    指定した停止中のジョブ(省略時はカレントジョブ)をバックグラウンドで再開します。",
  },
  kill: {
    summary: "プロセスやジョブを終了させる",
    body: "NAME\n    kill - プロセスを終了させる\n\nSYNOPSIS\n    kill [-シグナル] PID | %ジョブ番号...\n\nDESCRIPTION\n    指定したPIDまたはジョブ番号のプロセスを終了させます。\n    root以外は自分が所有するプロセスのみ終了できます。",
  },
  sed: {
    summary: "テキストをストリーム的に編集する(置換・削除・抽出)",
    body: "NAME\n    sed - テキストの検索・置換・削除を行う\n\nSYNOPSIS\n    sed [-n] スクリプト ファイル...\n\nDESCRIPTION\n    ファイルを1行ずつ読み込み、スクリプトに従って編集します。\n    -n  自動出力を抑制する(pコマンドで明示的に出力した行のみ表示)\n\n    アドレス指定: 行番号・`$`(最終行)・`/正規表現/`・`アドレス1,アドレス2`(範囲)\n    コマンド:\n      d          パターンスペースを削除する\n      p          パターンスペースを出力する\n      s/前/後/g  正規表現にマッチした部分を置換する(gで全置換、`\\1`で後方参照)",
  },
  awk: {
    summary: "パターンに応じたアクションを実行するテキスト処理言語",
    body: "NAME\n    awk - パターンマッチによるテキスト処理を行う\n\nSYNOPSIS\n    awk [-F 区切り文字] 'パターン { アクション }' ファイル...\n\nDESCRIPTION\n    ファイルを1行ずつ読み込み、パターンに一致した行に対してアクションを実行します。\n    -F  フィールド区切り文字を指定する(デフォルトは空白文字)\n\n    フィールド変数: $0(行全体)・$1〜$NF(各フィールド)\n    組み込み変数: NR(現在の行番号)・NF(フィールド数)\n    BEGIN{...}はデータ処理前に、END{...}はデータ処理後に一度だけ実行される。",
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
