import { createDirectory, createFile } from "../engine/vfs";
import type { VfsDirectoryNode, VfsNode, VfsSnapshot } from "../engine/vfs";

/** `study`ユーザー所有の演習用ディレクトリに共通の所有者/パーミッション。 */
const STUDY_DIR_OPTIONS = { owner: "study", group: "study", mode: 0o755 } as const;

/**
 * `/bin`, `/usr/bin` 用のダミー実行ファイル一覧。
 * 実際のcontentは持たず、名前・サイズ・パーミッションのみを持つ(du/sort/ls演習で使用)。
 */
function createBinDirectory(name: string, commands: readonly (readonly [string, number])[]): VfsDirectoryNode {
  const children: Record<string, VfsNode> = {};
  for (const [commandName, size] of commands) {
    children[commandName] = createFile(commandName, "", {
      owner: "root",
      group: "root",
      mode: 0o755,
      size,
    });
  }
  return createDirectory(name, children, { owner: "root", group: "root", mode: 0o755 });
}

const BIN_COMMANDS: readonly (readonly [string, number])[] = [
  ["bash", 1037528],
  ["cat", 35064],
  ["chmod", 64296],
  ["chown", 64951],
  ["cp", 158680],
  ["date", 68976],
  ["dd", 68472],
  ["df", 111664],
  ["echo", 35040],
  ["kill", 39144],
  ["ln", 60016],
  ["ls", 138208],
  ["mkdir", 64008],
  ["mount", 78168],
  ["mv", 154456],
  ["ps", 149160],
  ["pwd", 34952],
  ["rm", 68792],
  ["rmdir", 39096],
  ["sh", 1037528],
  ["sleep", 39096],
  ["sync", 34960],
  ["tar", 424128],
  ["touch", 60112],
  ["uname", 39320],
];

const USR_BIN_COMMANDS: readonly (readonly [string, number])[] = [
  ["awk", 429672],
  ["cut", 47080],
  ["diff", 154696],
  ["du", 105056],
  ["find", 305720],
  ["grep", 209800],
  ["gzip", 96792],
  ["head", 43104],
  ["less", 165840],
  ["locate", 47376],
  ["man", 63864],
  ["more", 39544],
  ["sed", 129008],
  ["sort", 149280],
  ["ssh", 916160],
  ["tail", 63848],
  ["tr", 66600],
  ["uniq", 51048],
  ["vim", 3245840],
  ["wc", 43168],
  ["which", 35000],
  ["xargs", 55336],
];

const PASSWD_CONTENT = `root:x:0:0:root:/root:/bin/bash
bin:x:1:1:bin:/bin:/usr/sbin/nologin
daemon:x:2:2:daemon:/sbin:/usr/sbin/nologin
adm:x:3:4:adm:/var/adm:/usr/sbin/nologin
lp:x:4:7:lp:/var/spool/lpd:/usr/sbin/nologin
sync:x:5:0:sync:/sbin:/bin/sync
shutdown:x:6:0:shutdown:/sbin:/sbin/shutdown
halt:x:7:0:halt:/sbin:/sbin/halt
mail:x:8:12:mail:/var/spool/mail:/usr/sbin/nologin
operator:x:11:0:operator:/root:/usr/sbin/nologin
games:x:12:100:games:/usr/games:/usr/sbin/nologin
ftp:x:14:50:FTP User:/var/ftp:/usr/sbin/nologin
nobody:x:65534:65534:Nobody:/:/usr/sbin/nologin
systemd-network:x:192:192:systemd Network Management:/:/usr/sbin/nologin
dbus:x:81:81:System message bus:/:/usr/sbin/nologin
polkitd:x:999:998:User for polkitd:/:/usr/sbin/nologin
sshd:x:74:74:Privilege-separated SSH:/var/empty/sshd:/usr/sbin/nologin
chrony:x:998:996:chrony:/var/lib/chrony:/usr/sbin/nologin
tcpdump:x:72:72::/:/usr/sbin/nologin
study:x:1000:1000:study:/home/study:/bin/bash
`;

const CRONTAB_CONTENT = `SHELL=/bin/bash
PATH=/sbin:/bin:/usr/sbin:/usr/bin
MAILTO=root

# For details see man 4 crontabs

# Example of job definition:
# .---------------- minute (0 - 59)
# |  .------------- hour (0 - 23)
# |  |  .---------- day of month (1 - 31)
# |  |  |  .------- month (1 - 12)
# |  |  |  |  .---- day of week (0 - 6) (Sunday=0 or 7)
# |  |  |  |  |
# *  *  *  *  * user-name command to be executed
17 *	* * *	root cd / && run-parts --report /etc/cron.hourly
25 6	* * *	root test -x /usr/sbin/anacron || run-parts --report /etc/cron.daily
`;

const BASHRC_CONTENT = `# /etc/bashrc

# System wide functions and aliases
# Environment stuff goes in /etc/profile

if [ -z "$PS1" ]; then
   return
fi

PS1='[\\u@\\h \\W]\\$ '
export PATH USER LOGNAME MAIL HOSTNAME HISTSIZE
`;

const STUDY_BASHRC_CONTENT = `# .bashrc

# Source global definitions
if [ -f /etc/bashrc ]; then
	. /etc/bashrc
fi

export PATH="$HOME/bin:$PATH"
`;

const STUDY_BASH_PROFILE_CONTENT = `# .bash_profile

# Get the aliases and functions
if [ -f ~/.bashrc ]; then
	. ~/.bashrc
fi

PATH=$PATH:$HOME/bin
export PATH
`;

const CH04_SAMPLE_TXT = `Hello, Linux!
`;

const CH04_NOTES_TXT = `今日の作業メモ。
`;

const CH04_TODO_TXT = `- 資料をまとめる
- レビュー依頼をする
`;

const CH04_HIDDEN_NOTE_TXT = `これは隠しファイルです。
`;

const CH04_REPORT_TXT = `月次レポートの下書き。
`;

const CH04_PLAN_TXT = `プロジェクト計画書。
`;

const CH04_BUDGET_CSV = `item,amount
server,5000
license,3000
`;

const CH04_SUMMER_MEMO_TXT = `夏の思い出メモ。
`;

const CH04_WINTER_MEMO_TXT = `冬の思い出メモ。
`;

const CH05_MEMO_TXT = `買い物リスト
- 牛乳
- 卵
- パン
`;

const CH05_REPORT_TXT = `週次レポート。
`;

const CH05_DATA_CSV = `id,value
1,10
2,20
`;

const CH05_CONFIG_INI = `[general]
debug=false
`;

const CH05_IMAGE_PNG = `PNGDUMMYDATA`;

const CH05_DRAFT1_TXT = `下書き1号。
`;

const CH05_DRAFT2_TXT = `下書き2号。
`;

const CH05_TEMP_LOG = `一時的なログファイル。
`;

const CH05_README_TXT = `このディレクトリの説明ファイル。
`;

const CH05_APP_JS = `console.log("hello");
`;

const CH06_TARGET_TXT = `This is the target file for the find practice.
`;

const CH06_README_MD = `# ch06_search 演習用ディレクトリ
`;

const CH06_JAN2023_TXT = `2023年1月のレポート。
`;

const CH06_FEB2023_TXT = `2023年2月のレポート。
`;

const CH06_SUMMARY2023_LOG = `2023年のサマリーログ。
`;

const CH06_JAN2024_TXT = `2024年1月のレポート。
`;

const CH06_MAR2024_TXT = `2024年3月のレポート。
`;

const CH06_NOTES2024_MD = `2024年のメモ。
`;

const CH06_LOGO_PNG = `PNGDUMMYDATA`;

const CH06_BANNER_JPG = `JPGDUMMYDATA`;

const CH06_SETUP_SH = `#!/bin/bash
echo "setup"
`;

const CH06_DEPLOY_SH = `#!/bin/bash
echo "deploy"
`;

const CH06_APP_CONF = `port=8080
`;

const CH06_DB_CONF = `host=localhost
`;

const CH08_GREET_SH = `#!/bin/bash
echo "Hello from greet!"
`;

const CH08_DEPLOY_SH = `#!/bin/bash
echo "Deploying..."
`;

const CH08_SITE_CONF = `server_name=example.local
port=8080
`;

const CH09_SECRET_TXT = `This is a confidential memo.
`;

const CH09_SCRIPT_SH = `#!/bin/bash
echo "Hello, world!"
`;

const CH09_MEMO_TXT = `会議メモ: 来週の定例は水曜10時から。
`;

const CH09_DIARY_TXT = `今日はパーミッションについて勉強した。
`;

const CH09_TODO_TXT = `- 資料を共有する
- レビューを依頼する
`;

const CH09_REPORT_CSV = `name,score
alice,90
bob,85
`;

const CH09_NOTES_MD = `# 個人メモ

まだ下書き段階。
`;

const CH09_DATA_JSON = `{"status": "ok"}
`;

const CH09_INSTALL_SH = `#!/bin/bash
echo "Installing..."
`;

const CH09_DEPLOY_SH = `#!/bin/bash
echo "Deploying..."
`;

const CH09_BACKUP_SH = `#!/bin/bash
echo "Backing up..."
`;

const CH09_RUN_SH = `#!/bin/bash
echo "Running..."
`;

const CH09_CONFIG_YML = `env: production
`;

const CH09_APP_CONF = `timeout=30
`;

const CH09_DEBUG_LOG = `[DEBUG] started
`;

const CH09_ACCESS_LOG = `127.0.0.1 - GET /index.html 200
`;

const CH09_ID_RSA = `-----BEGIN OPENSSH PRIVATE KEY-----
dummydummydummydummydummy
-----END OPENSSH PRIVATE KEY-----
`;

const CH09_ID_RSA_PUB = `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI dummy study@example
`;

const CH09_READONLY_TXT = `このファイルは読み取り専用です。
`;

const CH09_DRAFT_TXT = `下書き中の文章。
`;

const CH09_SHARED_TXT = `チームで共有するメモ。
`;

const CH09_TEAMNOTES_TXT = `チームメンバー向けの引き継ぎ事項。
`;

const CH09_PUBLIC_INDEX_HTML = `<html><body>Hello</body></html>
`;

const CH09_PRIVATE_KEYS_TXT = `api_key=xxxxx
`;

const CH09_SHARED_PLAN_TXT = `プロジェクト計画のドラフト。
`;

const CH09_TEAM_ROSTER_TXT = `study, alice, bob
`;

const CH09_ARCHIVE_OLD_LOG = `2023-01-01 archived entry
`;

const CH11_OUTPUT_LOG = `2024-01-01 10:00:01 INFO Start process
2024-01-01 10:00:05 ERROR Connection failed
2024-01-01 10:00:10 INFO Retry
2024-01-01 10:00:12 INFO Connected
2024-01-01 10:00:20 ERROR Timeout
`;

const CH12_FILE1_TXT = `東京
大阪
北海道
東京
福岡
大阪
京都
`;

const CH12_FILE2_TXT = `福岡
北海道
沖縄
東京
愛知
`;

const CH12_NUMBER_TXT = `10
3
25
7
100
2
18
`;

const CH12_SCORE_CSV = `name,score,class
Yamada,80,A
Sato,65,B
Suzuki,92,A
Tanaka,45,C
Ito,78,B
`;

const CH13_DRINK_TXT = `Beer
Whisky
Wine
Beer
Sake
Wine
Vodka
Shochu
`;

const CH14_DRINK2_TXT = `Beer,500,Japan
Wine,750,France
Whisky,700,Scotland
Sake,720,Japan
Vodka,700,Russia
`;

const CH14_SCORE_TXT = `Yamada 80 90 70
Sato 65 70 60
Suzuki 92 88 95
`;

const CH11_ACCESS_LOG = `192.168.1.10 GET /index.html 200
192.168.1.11 GET /about.html 200
192.168.1.12 POST /login 401
192.168.1.10 GET /images/logo.png 200
192.168.1.13 GET /missing.html 404
192.168.1.11 GET /about.html 200
192.168.1.14 POST /login 500
192.168.1.10 GET /index.html 200
192.168.1.15 GET /contact.html 200
192.168.1.12 POST /login 200
`;

const CH11_MEMO1_TXT = `今日の予定
午前: 会議
`;

const CH11_MEMO2_TXT = `午後: 資料作成
夜: 読書
`;

const CH12_WORDS_TXT = `apple
Banana
apple
cherry
Banana
date
apple
Elderberry
cherry
fig
`;

const CH12_DIFF_OLD_TXT = `朝ごはんを食べる
歯を磨く
学校へ行く
宿題をする
寝る
`;

const CH12_DIFF_NEW_TXT = `朝ごはんを食べる
歯を磨く
公園へ行く
宿題をする
本を読む
寝る
`;

const CH13_CODES_TXT = `A-1234
B-5678
C-9012
AB-345
A-12
X-0000
A-1234X
foo-bar
A1234
A-12345
`;

const CH13_EMAILS_TXT = `alice@example.com
bob@example
carol123@test.co.jp
invalid-email
dave.smith@company.org
2024report@data.jp
eve@@example.com
frank@sub.example.com
`;

const CH14_EMPLOYEES_CSV = `Yamada,Sales,320000
Sato,Engineering,410000
Suzuki,Sales,290000
Tanaka,Engineering,450000
Ito,Marketing,300000
Watanabe,Sales,330000
`;

const CH18_README_MD = `# sample-project

アーカイブ演習用のサンプルプロジェクトです。
`;

const CH18_DATA_CSV = `id,name
1,Alice
2,Bob
3,Carol
`;

const CH18_APP_SH = `#!/bin/bash
echo "Hello from app.sh"
`;

const CH18_FILE_1_TXT = `file-1
`;
const CH18_FILE_2_TXT = `file-2
`;
const CH18_FILE_3_TXT = `file-3
`;
const CH18_FILE_4_TXT = `file-4
`;
const CH18_FILE_5_TXT = `file-5
`;

const CH18_PS_TXT = `  PID TTY          TIME CMD
 1000 pts/0    00:00:00 bash
 1042 pts/0    00:00:00 vim
 1088 pts/0    00:00:00 ps
`;

const CH18_ACCESS_LOG = `192.168.1.10 - - "GET /index.html HTTP/1.1" 200
192.168.1.11 - - "GET /about.html HTTP/1.1" 200
192.168.1.12 - - "GET /missing.html HTTP/1.1" 404
`;

const CH18_ERROR_LOG = `[error] file not found: missing.html
[error] connection timeout: 192.168.1.20
`;

const CH18_REPORTS_NOTES_TXT = `四半期レポートの下書き置き場です。
`;

const CH18_SUMMARY_TXT = `2024年のまとめ:
- 売上は前年比110%
- 主要な課題は在庫管理
`;

const CH19_MEMO_TXT = `会議メモ
- 次回の日程を決める
`;

const CH19_TODO_TXT = `TODO
- 資料を準備する
`;

const CH19_BRANCH_MEMO_TXT = `プロジェクトの概要をここに書く。
`;

const CH19_SYNC_MEMO_TXT = `同期演習用のメモ。
`;

const CH19_FINDGREP_SH = `#!/bin/bash

pattern=$1
find . -type f | xargs grep -nH "$pattern"
`;

function createCh0406PracticeChildren(): Record<string, VfsNode> {
  return {
    // pwd/cd/ls演習用。ネストしたディレクトリと隠しファイルを持ち、絶対/相対パスでの移動や
    // ls -a/-l の表示違いを確認できる構成にしている。
    ch04_fs: createDirectory("ch04_fs", {
      documents: createDirectory("documents", {
        "report.txt": createFile("report.txt", CH04_REPORT_TXT, { owner: "study", group: "study", mode: 0o644 }),
        "plan.txt": createFile("plan.txt", CH04_PLAN_TXT, { owner: "study", group: "study", mode: 0o644 }),
        "budget.csv": createFile("budget.csv", CH04_BUDGET_CSV, { owner: "study", group: "study", mode: 0o644 }),
      }, STUDY_DIR_OPTIONS),
      photos: createDirectory("photos", {
        "2023": createDirectory("2023", {}, STUDY_DIR_OPTIONS),
        "2024": createDirectory("2024", {
          summer: createDirectory("summer", {
            "memo.txt": createFile("memo.txt", CH04_SUMMER_MEMO_TXT, { owner: "study", group: "study", mode: 0o644 }),
          }, STUDY_DIR_OPTIONS),
          winter: createDirectory("winter", {
            "memo.txt": createFile("memo.txt", CH04_WINTER_MEMO_TXT, { owner: "study", group: "study", mode: 0o644 }),
          }, STUDY_DIR_OPTIONS),
        }, STUDY_DIR_OPTIONS),
      }, STUDY_DIR_OPTIONS),
      work: createDirectory("work", {
        reports: createDirectory("reports", {}, STUDY_DIR_OPTIONS),
      }, STUDY_DIR_OPTIONS),
      "sample.txt": createFile("sample.txt", CH04_SAMPLE_TXT, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
      "notes.txt": createFile("notes.txt", CH04_NOTES_TXT, { owner: "study", group: "study", mode: 0o644 }),
      "todo.txt": createFile("todo.txt", CH04_TODO_TXT, { owner: "study", group: "study", mode: 0o644 }),
      ".hidden_note.txt": createFile(".hidden_note.txt", CH04_HIDDEN_NOTE_TXT, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
    }, STUDY_DIR_OPTIONS),

    // mkdir/touch/rm/rmdir/cp/mv/ln演習用。コピー元・移動先・削除対象を分けて用意している。
    ch05_fileops: createDirectory("ch05_fileops", {
      "memo.txt": createFile("memo.txt", CH05_MEMO_TXT, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
      "report.txt": createFile("report.txt", CH05_REPORT_TXT, { owner: "study", group: "study", mode: 0o644 }),
      "data.csv": createFile("data.csv", CH05_DATA_CSV, { owner: "study", group: "study", mode: 0o644 }),
      "config.ini": createFile("config.ini", CH05_CONFIG_INI, { owner: "study", group: "study", mode: 0o644 }),
      "image.png": createFile("image.png", CH05_IMAGE_PNG, { owner: "study", group: "study", mode: 0o644 }),
      backup: createDirectory("backup", {}, STUDY_DIR_OPTIONS),
      archive: createDirectory("archive", {}, STUDY_DIR_OPTIONS),
      empty_folder: createDirectory("empty_folder", {}, STUDY_DIR_OPTIONS),
      another_empty: createDirectory("another_empty", {}, STUDY_DIR_OPTIONS),
      old_files: createDirectory("old_files", {
        "draft1.txt": createFile("draft1.txt", CH05_DRAFT1_TXT, { owner: "study", group: "study", mode: 0o644 }),
        "draft2.txt": createFile("draft2.txt", CH05_DRAFT2_TXT, { owner: "study", group: "study", mode: 0o644 }),
        "temp.log": createFile("temp.log", CH05_TEMP_LOG, { owner: "study", group: "study", mode: 0o644 }),
      }, STUDY_DIR_OPTIONS),
      project: createDirectory("project", {
        "README.md": createFile("README.md", CH05_README_TXT, { owner: "study", group: "study", mode: 0o644 }),
        src: createDirectory("src", {
          "app.js": createFile("app.js", CH05_APP_JS, { owner: "study", group: "study", mode: 0o644 }),
        }, STUDY_DIR_OPTIONS),
      }, STUDY_DIR_OPTIONS),
    }, STUDY_DIR_OPTIONS),

    // find/locate/which演習用。拡張子や日付違いのファイルを複数のディレクトリに分散配置し、
    // -name/-type による絞り込みの違いを確認できる構成にしている。
    ch06_search: createDirectory("ch06_search", {
      "readme.md": createFile("readme.md", CH06_README_MD, { owner: "study", group: "study", mode: 0o644 }),
      deep: createDirectory("deep", {
        a: createDirectory("a", {
          b: createDirectory("b", {
            c: createDirectory("c", {
              "target.txt": createFile("target.txt", CH06_TARGET_TXT, {
                owner: "study",
                group: "study",
                mode: 0o644,
              }),
            }, STUDY_DIR_OPTIONS),
          }, STUDY_DIR_OPTIONS),
        }, STUDY_DIR_OPTIONS),
      }, STUDY_DIR_OPTIONS),
      reports: createDirectory("reports", {
        "2023": createDirectory("2023", {
          "jan.txt": createFile("jan.txt", CH06_JAN2023_TXT, { owner: "study", group: "study", mode: 0o644 }),
          "feb.txt": createFile("feb.txt", CH06_FEB2023_TXT, { owner: "study", group: "study", mode: 0o644 }),
          "summary.log": createFile("summary.log", CH06_SUMMARY2023_LOG, {
            owner: "study",
            group: "study",
            mode: 0o644,
          }),
        }, STUDY_DIR_OPTIONS),
        "2024": createDirectory("2024", {
          "jan.txt": createFile("jan.txt", CH06_JAN2024_TXT, { owner: "study", group: "study", mode: 0o644 }),
          "mar.txt": createFile("mar.txt", CH06_MAR2024_TXT, { owner: "study", group: "study", mode: 0o644 }),
          "notes.md": createFile("notes.md", CH06_NOTES2024_MD, { owner: "study", group: "study", mode: 0o644 }),
        }, STUDY_DIR_OPTIONS),
      }, STUDY_DIR_OPTIONS),
      images: createDirectory("images", {
        "logo.png": createFile("logo.png", CH06_LOGO_PNG, { owner: "study", group: "study", mode: 0o644 }),
        "banner.jpg": createFile("banner.jpg", CH06_BANNER_JPG, { owner: "study", group: "study", mode: 0o644 }),
      }, STUDY_DIR_OPTIONS),
      scripts: createDirectory("scripts", {
        "setup.sh": createFile("setup.sh", CH06_SETUP_SH, { owner: "study", group: "study", mode: 0o755 }),
        "deploy.sh": createFile("deploy.sh", CH06_DEPLOY_SH, { owner: "study", group: "study", mode: 0o755 }),
      }, STUDY_DIR_OPTIONS),
      config: createDirectory("config", {
        "app.conf": createFile("app.conf", CH06_APP_CONF, { owner: "study", group: "study", mode: 0o644 }),
        "db.conf": createFile("db.conf", CH06_DB_CONF, { owner: "study", group: "study", mode: 0o644 }),
      }, STUDY_DIR_OPTIONS),
      empty_project: createDirectory("empty_project", {}, STUDY_DIR_OPTIONS),
    }, STUDY_DIR_OPTIONS),
  };
}

function createCh08PracticeChildren(): Record<string, VfsNode> {
  return {
    // PATH操作・whichによるコマンド探索演習用。実行権限付きのダミーコマンドを
    // ホームディレクトリ配下の非標準ディレクトリに置くことで、PATHに追加するまでは
    // whichで見つからない状態を再現できる。
    ch08_env: createDirectory(
      "ch08_env",
      {
        mytools: createDirectory(
          "mytools",
          {
            greet: createFile("greet", CH08_GREET_SH, { owner: "study", group: "study", mode: 0o755 }),
            deploy: createFile("deploy", CH08_DEPLOY_SH, { owner: "study", group: "study", mode: 0o755 }),
          },
          STUDY_DIR_OPTIONS,
        ),
        config: createDirectory(
          "config",
          {
            "site.conf": createFile("site.conf", CH08_SITE_CONF, { owner: "study", group: "study", mode: 0o644 }),
          },
          STUDY_DIR_OPTIONS,
        ),
      },
      STUDY_DIR_OPTIONS,
    ),
  };
}

function createCh09PracticeChildren(): Record<string, VfsNode> {
  return {
    ch09_permissions: createDirectory(
      "ch09_permissions",
      {
        "secret.txt": createFile("secret.txt", CH09_SECRET_TXT, {
          owner: "study",
          group: "study",
          mode: 0o600,
        }),
        "script.sh": createFile("script.sh", CH09_SCRIPT_SH, {
          owner: "study",
          group: "study",
          mode: 0o644,
        }),
        "memo.txt": createFile("memo.txt", CH09_MEMO_TXT, {
          owner: "study",
          group: "study",
          mode: 0o644,
        }),
        "diary.txt": createFile("diary.txt", CH09_DIARY_TXT, {
          owner: "study",
          group: "study",
          mode: 0o600,
        }),
        "todo.txt": createFile("todo.txt", CH09_TODO_TXT, {
          owner: "study",
          group: "study",
          mode: 0o664,
        }),
        "report.csv": createFile("report.csv", CH09_REPORT_CSV, {
          owner: "study",
          group: "study",
          mode: 0o640,
        }),
        "notes.md": createFile("notes.md", CH09_NOTES_MD, {
          owner: "study",
          group: "study",
          mode: 0o600,
        }),
        "data.json": createFile("data.json", CH09_DATA_JSON, {
          owner: "study",
          group: "study",
          mode: 0o644,
        }),
        "install.sh": createFile("install.sh", CH09_INSTALL_SH, {
          owner: "study",
          group: "study",
          mode: 0o644,
        }),
        "deploy.sh": createFile("deploy.sh", CH09_DEPLOY_SH, {
          owner: "study",
          group: "study",
          mode: 0o700,
        }),
        "backup.sh": createFile("backup.sh", CH09_BACKUP_SH, {
          owner: "study",
          group: "study",
          mode: 0o750,
        }),
        "run.sh": createFile("run.sh", CH09_RUN_SH, {
          owner: "study",
          group: "study",
          mode: 0o600,
        }),
        "config.yml": createFile("config.yml", CH09_CONFIG_YML, {
          owner: "study",
          group: "study",
          mode: 0o664,
        }),
        "app.conf": createFile("app.conf", CH09_APP_CONF, {
          owner: "study",
          group: "study",
          mode: 0o644,
        }),
        "debug.log": createFile("debug.log", CH09_DEBUG_LOG, {
          owner: "study",
          group: "study",
          mode: 0o666,
        }),
        "access.log": createFile("access.log", CH09_ACCESS_LOG, {
          owner: "study",
          group: "study",
          mode: 0o644,
        }),
        id_rsa: createFile("id_rsa", CH09_ID_RSA, {
          owner: "study",
          group: "study",
          mode: 0o644,
        }),
        "id_rsa.pub": createFile("id_rsa.pub", CH09_ID_RSA_PUB, {
          owner: "study",
          group: "study",
          mode: 0o600,
        }),
        "readonly.txt": createFile("readonly.txt", CH09_READONLY_TXT, {
          owner: "study",
          group: "study",
          mode: 0o444,
        }),
        "draft.txt": createFile("draft.txt", CH09_DRAFT_TXT, {
          owner: "study",
          group: "study",
          mode: 0o600,
        }),
        "shared.txt": createFile("shared.txt", CH09_SHARED_TXT, {
          owner: "study",
          group: "study",
          mode: 0o664,
        }),
        "teamnotes.txt": createFile("teamnotes.txt", CH09_TEAMNOTES_TXT, {
          owner: "study",
          group: "study",
          mode: 0o640,
        }),
        public_dir: createDirectory(
          "public_dir",
          {
            "index.html": createFile("index.html", CH09_PUBLIC_INDEX_HTML, {
              owner: "study",
              group: "study",
              mode: 0o644,
            }),
          },
          { owner: "study", group: "study", mode: 0o700 },
        ),
        private_dir: createDirectory(
          "private_dir",
          {
            "keys.txt": createFile("keys.txt", CH09_PRIVATE_KEYS_TXT, {
              owner: "study",
              group: "study",
              mode: 0o600,
            }),
          },
          { owner: "study", group: "study", mode: 0o755 },
        ),
        shared_dir: createDirectory(
          "shared_dir",
          {
            "plan.txt": createFile("plan.txt", CH09_SHARED_PLAN_TXT, {
              owner: "study",
              group: "study",
              mode: 0o664,
            }),
          },
          { owner: "study", group: "study", mode: 0o755 },
        ),
        team_dir: createDirectory(
          "team_dir",
          {
            "roster.txt": createFile("roster.txt", CH09_TEAM_ROSTER_TXT, {
              owner: "study",
              group: "study",
              mode: 0o644,
            }),
          },
          { owner: "study", group: "study", mode: 0o700 },
        ),
        archive_dir: createDirectory(
          "archive_dir",
          {
            "old.log": createFile("old.log", CH09_ARCHIVE_OLD_LOG, {
              owner: "study",
              group: "study",
              mode: 0o644,
            }),
          },
          { owner: "study", group: "study", mode: 0o777 },
        ),
      },
      STUDY_DIR_OPTIONS,
    ),
  };
}

function createCh1114PracticeChildren(): Record<string, VfsNode> {
  return {
    ch11_pipeline: createDirectory("ch11_pipeline", {
      "output.log": createFile("output.log", CH11_OUTPUT_LOG, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
      "access.log": createFile("access.log", CH11_ACCESS_LOG, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
      "memo1.txt": createFile("memo1.txt", CH11_MEMO1_TXT, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
      "memo2.txt": createFile("memo2.txt", CH11_MEMO2_TXT, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
    }, STUDY_DIR_OPTIONS),

    ch12_textproc: createDirectory("ch12_textproc", {
      "file1.txt": createFile("file1.txt", CH12_FILE1_TXT, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
      "file2.txt": createFile("file2.txt", CH12_FILE2_TXT, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
      "number.txt": createFile("number.txt", CH12_NUMBER_TXT, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
      "score.csv": createFile("score.csv", CH12_SCORE_CSV, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
      "words.txt": createFile("words.txt", CH12_WORDS_TXT, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
      "diff_old.txt": createFile("diff_old.txt", CH12_DIFF_OLD_TXT, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
      "diff_new.txt": createFile("diff_new.txt", CH12_DIFF_NEW_TXT, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
    }, STUDY_DIR_OPTIONS),

    ch13_regex: createDirectory("ch13_regex", {
      "drink.txt": createFile("drink.txt", CH13_DRINK_TXT, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
      "codes.txt": createFile("codes.txt", CH13_CODES_TXT, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
      "emails.txt": createFile("emails.txt", CH13_EMAILS_TXT, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
    }, STUDY_DIR_OPTIONS),

    ch14_sedawk: createDirectory("ch14_sedawk", {
      "drink2.txt": createFile("drink2.txt", CH14_DRINK2_TXT, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
      "score.txt": createFile("score.txt", CH14_SCORE_TXT, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
      "employees.csv": createFile("employees.csv", CH14_EMPLOYEES_CSV, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
    }, STUDY_DIR_OPTIONS),
  };
}

// chmod演習用。実行権限の有無・付与範囲が異なる複数のスクリプトを用意し、
// ls -l で表示されるパーミッション文字列の違いを確認できるようにする(いずれも
// 本シミュレータではスクリプトの実際の実行はサポートしないため、中身はダミー)。
const CH1517_HELLO_SH = `#!/bin/bash
echo "Hello, World!"
`;

const CH1517_GREET_SH = `#!/bin/bash
echo "Hi there!"
`;

const CH1517_BACKUP_SH = `#!/bin/bash
# TODO: 圧縮してからコピーする
echo "starting backup..."
echo "backup complete"
`;

const CH1517_DEPLOY_SH = `#!/bin/bash
echo "deploying application"
`;

const CH1517_REPORT_SH = `#!/bin/bash
# TODO: エラー処理を追加する
echo "generating report"
echo "done"
`;

// find/xargs/grep演習用のログファイル群。ERROR/INFO/WARNの行を混在させ、
// パターン検索や複数ファイルにまたがるgrepの練習に使う。
const CH1517_APP_LOG = `INFO  server started
ERROR failed to connect to database
INFO  retrying connection
ERROR timeout while retrying
INFO  connection established
`;

const CH1517_DB_LOG = `INFO  migration started
ERROR duplicate key value
INFO  migration finished
`;

const CH1517_ACCESS_LOG = `INFO  GET /index.html 200
INFO  GET /about.html 200
ERROR GET /missing.html 404
`;

// find/xargs/grepをネストしたディレクトリに対して再帰的に使う演習用。
const CH1517_PROJECT_README_MD = `# Sample Project

TODO: write documentation
`;

const CH1517_PROJECT_MAIN_SH = `#!/bin/bash
# TODO: 引数を検証する
echo "main script"
`;

const CH1517_PROJECT_LIB_SH = `#!/bin/bash
# TODO: ヘルパー関数を追加する
echo "lib script"
`;

const CH1517_PROJECT_NOTES_TXT = `meeting notes
TODO: schedule follow-up
`;

// IFS演習用。ファイル名にスペースを含むものを混在させ、for f in $(find ...) が
// デフォルトIFSでは単語分割によって崩れることを確認できるようにする。
const CH1517_SPACEY_DAILY_NOTES_TXT = `memo
`;

const CH1517_SPACEY_TODO_LIST_TXT = `buy milk
`;

const CH1517_SPACEY_PLAIN_TXT = `no spaces here
`;

// PATH追加演習用。~/binではなくpractice配下に置き、PATHに追加するまでは
// コマンド名だけでは見つからない状態を再現する(Ch8のmytoolsと同様のパターン)。
const CH1517_MYTOOLS_HELLO = `#!/bin/bash
echo "Hello from hello tool!"
`;

// -- によるハイフン引数対策演習用。ハイフンで始まる名前のファイルを用意しておく。
const CH1517_DASH_FILE_TXT = `this file name starts with a hyphen
`;

function createCh1517PracticeChildren(): Record<string, VfsNode> {
  return {
    ch15_17_shellscript: createDirectory(
      "ch15_17_shellscript",
      {
        scripts: createDirectory(
          "scripts",
          {
            "hello.sh": createFile("hello.sh", CH1517_HELLO_SH, { owner: "study", group: "study", mode: 0o644 }),
            "greet.sh": createFile("greet.sh", CH1517_GREET_SH, { owner: "study", group: "study", mode: 0o755 }),
            "backup.sh": createFile("backup.sh", CH1517_BACKUP_SH, { owner: "study", group: "study", mode: 0o750 }),
            "deploy.sh": createFile("deploy.sh", CH1517_DEPLOY_SH, { owner: "study", group: "study", mode: 0o700 }),
            "report.sh": createFile("report.sh", CH1517_REPORT_SH, { owner: "study", group: "study", mode: 0o644 }),
          },
          STUDY_DIR_OPTIONS,
        ),
        logs: createDirectory(
          "logs",
          {
            "app.log": createFile("app.log", CH1517_APP_LOG, { owner: "study", group: "study", mode: 0o644 }),
            "db.log": createFile("db.log", CH1517_DB_LOG, { owner: "study", group: "study", mode: 0o644 }),
            "access.log": createFile("access.log", CH1517_ACCESS_LOG, { owner: "study", group: "study", mode: 0o644 }),
          },
          STUDY_DIR_OPTIONS,
        ),
        project: createDirectory(
          "project",
          {
            "README.md": createFile("README.md", CH1517_PROJECT_README_MD, {
              owner: "study",
              group: "study",
              mode: 0o644,
            }),
            src: createDirectory(
              "src",
              {
                "main.sh": createFile("main.sh", CH1517_PROJECT_MAIN_SH, {
                  owner: "study",
                  group: "study",
                  mode: 0o755,
                }),
                "lib.sh": createFile("lib.sh", CH1517_PROJECT_LIB_SH, {
                  owner: "study",
                  group: "study",
                  mode: 0o755,
                }),
              },
              STUDY_DIR_OPTIONS,
            ),
            docs: createDirectory(
              "docs",
              {
                "notes.txt": createFile("notes.txt", CH1517_PROJECT_NOTES_TXT, {
                  owner: "study",
                  group: "study",
                  mode: 0o644,
                }),
              },
              STUDY_DIR_OPTIONS,
            ),
          },
          STUDY_DIR_OPTIONS,
        ),
        spacey: createDirectory(
          "spacey",
          {
            "daily notes.txt": createFile("daily notes.txt", CH1517_SPACEY_DAILY_NOTES_TXT, {
              owner: "study",
              group: "study",
              mode: 0o644,
            }),
            "todo list.txt": createFile("todo list.txt", CH1517_SPACEY_TODO_LIST_TXT, {
              owner: "study",
              group: "study",
              mode: 0o644,
            }),
            "plain.txt": createFile("plain.txt", CH1517_SPACEY_PLAIN_TXT, {
              owner: "study",
              group: "study",
              mode: 0o644,
            }),
          },
          STUDY_DIR_OPTIONS,
        ),
        mytools: createDirectory(
          "mytools",
          {
            hello: createFile("hello", CH1517_MYTOOLS_HELLO, { owner: "study", group: "study", mode: 0o755 }),
          },
          STUDY_DIR_OPTIONS,
        ),
        "-oldfile.txt": createFile("-oldfile.txt", CH1517_DASH_FILE_TXT, {
          owner: "study",
          group: "study",
          mode: 0o644,
        }),
      },
      STUDY_DIR_OPTIONS,
    ),
  };
}

function createCh18PracticeChildren(): Record<string, VfsNode> {
  return {
    ch18_archive: createDirectory("ch18_archive", {
      project: createDirectory("project", {
        "README.md": createFile("README.md", CH18_README_MD, {
          owner: "study",
          group: "study",
          mode: 0o644,
        }),
        "data.csv": createFile("data.csv", CH18_DATA_CSV, {
          owner: "study",
          group: "study",
          mode: 0o644,
        }),
        src: createDirectory("src", {
          "app.sh": createFile("app.sh", CH18_APP_SH, {
            owner: "study",
            group: "study",
            mode: 0o755,
          }),
        }, STUDY_DIR_OPTIONS),
      }, STUDY_DIR_OPTIONS),
      // 書籍p345のtar解説で使われる典型例(mkdir dir1; touch dir1/file-{1..5}.txt)に準拠した
      // フィクスチャ。本アプリのシェルはブレース展開`{1..5}`に対応していないため、あらかじめ
      // 5つのファイルを用意しておく。
      dir1: createDirectory("dir1", {
        "file-1.txt": createFile("file-1.txt", CH18_FILE_1_TXT, {
          owner: "study",
          group: "study",
          mode: 0o644,
        }),
        "file-2.txt": createFile("file-2.txt", CH18_FILE_2_TXT, {
          owner: "study",
          group: "study",
          mode: 0o644,
        }),
        "file-3.txt": createFile("file-3.txt", CH18_FILE_3_TXT, {
          owner: "study",
          group: "study",
          mode: 0o644,
        }),
        "file-4.txt": createFile("file-4.txt", CH18_FILE_4_TXT, {
          owner: "study",
          group: "study",
          mode: 0o644,
        }),
        "file-5.txt": createFile("file-5.txt", CH18_FILE_5_TXT, {
          owner: "study",
          group: "study",
          mode: 0o644,
        }),
      }, STUDY_DIR_OPTIONS),
      // 書籍p350のgzip解説で使われる典型例(ps aux > ps.txt)に準拠した単体ファイル。
      "ps.txt": createFile("ps.txt", CH18_PS_TXT, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
      logs: createDirectory("logs", {
        "access.log": createFile("access.log", CH18_ACCESS_LOG, {
          owner: "study",
          group: "study",
          mode: 0o644,
        }),
        "error.log": createFile("error.log", CH18_ERROR_LOG, {
          owner: "study",
          group: "study",
          mode: 0o644,
        }),
      }, STUDY_DIR_OPTIONS),
      reports: createDirectory("reports", {
        "notes.txt": createFile("notes.txt", CH18_REPORTS_NOTES_TXT, {
          owner: "study",
          group: "study",
          mode: 0o644,
        }),
        "2024": createDirectory("2024", {
          "summary.txt": createFile("summary.txt", CH18_SUMMARY_TXT, {
            owner: "study",
            group: "study",
            mode: 0o644,
          }),
        }, STUDY_DIR_OPTIONS),
      }, STUDY_DIR_OPTIONS),
    }, STUDY_DIR_OPTIONS),
  };
}

function createCh19PracticeChildren(): Record<string, VfsNode> {
  return {
    ch19_git: createDirectory("ch19_git", {
      // git init/status/add/commit/log演習用。まだGitリポジトリ化されていない状態の作業ツリー。
      notes: createDirectory("notes", {
        "memo.txt": createFile("memo.txt", CH19_MEMO_TXT, {
          owner: "study",
          group: "study",
          mode: 0o644,
        }),
        "todo.txt": createFile("todo.txt", CH19_TODO_TXT, {
          owner: "study",
          group: "study",
          mode: 0o644,
        }),
      }, STUDY_DIR_OPTIONS),

      // branch/checkout/merge演習用。演習ごとにgit initからやり直す想定の作業ツリー。
      "branch-practice": createDirectory("branch-practice", {
        "memo.txt": createFile("memo.txt", CH19_BRANCH_MEMO_TXT, {
          owner: "study",
          group: "study",
          mode: 0o644,
        }),
      }, STUDY_DIR_OPTIONS),

      // remote/push/pull演習用。"../sync-practice-remote" を疑似リモートとして演習内でgit initする想定。
      "sync-practice": createDirectory("sync-practice", {
        "memo.txt": createFile("memo.txt", CH19_SYNC_MEMO_TXT, {
          owner: "study",
          group: "study",
          mode: 0o644,
        }),
      }, STUDY_DIR_OPTIONS),

      // 書籍19章の一貫シナリオ(CHAPTER17で作ったfindgrep.shをGitで管理する)用。まだgit initされていない。
      findgrep: createDirectory("findgrep", {
        "findgrep.sh": createFile("findgrep.sh", CH19_FINDGREP_SH, {
          owner: "study",
          group: "study",
          mode: 0o755,
        }),
      }, STUDY_DIR_OPTIONS),
    }, STUDY_DIR_OPTIONS),
  };
}

function createStudyHomeDirectory(practiceChildren: Record<string, VfsNode>): VfsDirectoryNode {
  return createDirectory("study", {
    ".bashrc": createFile(".bashrc", STUDY_BASHRC_CONTENT, {
      owner: "study",
      group: "study",
      mode: 0o644,
    }),
    ".bash_profile": createFile(".bash_profile", STUDY_BASH_PROFILE_CONTENT, {
      owner: "study",
      group: "study",
      mode: 0o644,
    }),
    bin: createDirectory("bin", {}, STUDY_DIR_OPTIONS),
    practice: createDirectory("practice", practiceChildren, STUDY_DIR_OPTIONS),
  }, STUDY_DIR_OPTIONS);
}

/**
 * 全スナップショットに共通するルート構造(`/bin`, `/usr/bin`, `/etc`, `/dev`, `/home/study`)を組み立てる。
 * `study`という非rootユーザーとして開始し、`/etc`・`/bin`はroot所有・書き込み不可にすることで、
 * Ch9(パーミッション)・sudo演習の権限エラーを自然に再現する(docs/requirements.md 4章参照)。
 * `practiceChildren`にはスナップショットごとに異なる演習グループ専用のフィクスチャを渡す。
 */
function createBaseRoot(practiceChildren: Record<string, VfsNode>): VfsDirectoryNode {
  return createDirectory(
    "",
    {
      bin: createBinDirectory("bin", BIN_COMMANDS),
      usr: createDirectory(
        "usr",
        {
          bin: createBinDirectory("bin", USR_BIN_COMMANDS),
        },
        { owner: "root", group: "root", mode: 0o755 },
      ),
      etc: createDirectory(
        "etc",
        {
          passwd: createFile("passwd", PASSWD_CONTENT, {
            owner: "root",
            group: "root",
            mode: 0o644,
          }),
          crontab: createFile("crontab", CRONTAB_CONTENT, {
            owner: "root",
            group: "root",
            mode: 0o644,
          }),
          bashrc: createFile("bashrc", BASHRC_CONTENT, {
            owner: "root",
            group: "root",
            mode: 0o644,
          }),
        },
        { owner: "root", group: "root", mode: 0o755 },
      ),
      dev: createDirectory(
        "dev",
        {
          null: createFile("null", "", { owner: "root", group: "root", mode: 0o666 }),
        },
        { owner: "root", group: "root", mode: 0o755 },
      ),
      home: createDirectory(
        "home",
        {
          study: createStudyHomeDirectory(practiceChildren),
        },
        { owner: "root", group: "root", mode: 0o755 },
      ),
    },
    { owner: "root", group: "root", mode: 0o755 },
  );
}

function buildChapterSnapshot(
  id: string,
  description: string,
  practiceChildren: Record<string, VfsNode> = {},
): VfsSnapshot {
  return { id, description, root: createBaseRoot(practiceChildren) };
}

/**
 * 章グループ(`Exercise.chapterId`)ごとの専用VFSスナップショット。
 * `/home/study/practice`配下に、そのグループの演習だけが使うフィクスチャを持たせることで、
 * 章間でのファイル名衝突や前提の矛盾を避ける(#89)。専用フィクスチャを持たない章
 * (Ch1, 2-3, 7, 8, 10, 20, appendix等)は`default`にフォールバックする。
 */
export const vfsSnapshots: Record<string, VfsSnapshot> = {
  "ch04-06": buildChapterSnapshot(
    "ch04-06",
    "Ch4〜6(ファイル操作の基本)演習用のVFS初期シードデータ",
    createCh0406PracticeChildren(),
  ),
  ch08: buildChapterSnapshot(
    "ch08",
    "Ch8(エイリアスと環境変数)演習用のVFS初期シードデータ",
    createCh08PracticeChildren(),
  ),
  ch09: buildChapterSnapshot(
    "ch09",
    "Ch9(パーミッション)演習用のVFS初期シードデータ",
    createCh09PracticeChildren(),
  ),
  "ch11-14": buildChapterSnapshot(
    "ch11-14",
    "Ch11〜14(パイプラインとテキスト処理・正規表現)演習用のVFS初期シードデータ",
    createCh1114PracticeChildren(),
  ),
  "ch15-17": buildChapterSnapshot(
    "ch15-17",
    "Ch15〜17(シェルスクリプト作成)演習用のVFS初期シードデータ",
    createCh1517PracticeChildren(),
  ),
  ch18: buildChapterSnapshot(
    "ch18",
    "Ch18(アーカイブとバックアップ)演習用のVFS初期シードデータ",
    createCh18PracticeChildren(),
  ),
  ch19: buildChapterSnapshot(
    "ch19",
    "Ch19(Gitによるバージョン管理)演習用のVFS初期シードデータ",
    createCh19PracticeChildren(),
  ),
  default: buildChapterSnapshot(
    "default",
    "practice配下の専用フィクスチャを持たない演習(Ch1, 2-3, 7, 10, 20, appendix等)用の共通VFS初期シードデータ",
  ),
};

/**
 * 演習の`chapterId`(必要なら明示指定の`vfsSnapshotId`)から、使用すべきVFSスナップショットを解決する。
 * 該当するスナップショットが登録されていない場合は`default`にフォールバックする。
 */
export function getVfsSnapshot(chapterId: string, vfsSnapshotId?: string): VfsSnapshot {
  return vfsSnapshots[vfsSnapshotId ?? chapterId] ?? vfsSnapshots.default;
}
