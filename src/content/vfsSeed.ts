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

const CH05_MEMO_TXT = `買い物リスト
- 牛乳
- 卵
- パン
`;

const CH06_TARGET_TXT = `This is the target file for the find practice.
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

function createCh0406PracticeChildren(): Record<string, VfsNode> {
  return {
    ch04_fs: createDirectory("ch04_fs", {
      documents: createDirectory("documents", {}, STUDY_DIR_OPTIONS),
      photos: createDirectory("photos", {}, STUDY_DIR_OPTIONS),
      "sample.txt": createFile("sample.txt", CH04_SAMPLE_TXT, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
    }, STUDY_DIR_OPTIONS),

    ch05_fileops: createDirectory("ch05_fileops", {
      "memo.txt": createFile("memo.txt", CH05_MEMO_TXT, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
      backup: createDirectory("backup", {}, STUDY_DIR_OPTIONS),
    }, STUDY_DIR_OPTIONS),

    ch06_search: createDirectory("ch06_search", {
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
    }, STUDY_DIR_OPTIONS),
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
        id_rsa: createFile("id_rsa", CH09_ID_RSA, { owner: "study", group: "study", mode: 0o644 }),
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
    }, STUDY_DIR_OPTIONS),

    ch13_regex: createDirectory("ch13_regex", {
      "drink.txt": createFile("drink.txt", CH13_DRINK_TXT, {
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
    }, STUDY_DIR_OPTIONS),
  };
}

function createCh1517PracticeChildren(): Record<string, VfsNode> {
  return {
    ch15_17_shellscript: createDirectory(
      "ch15_17_shellscript",
      {},
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
    "practice配下の専用フィクスチャを持たない演習(Ch1, 2-3, 7, 8, 10, 20, appendix等)用の共通VFS初期シードデータ",
  ),
};

/**
 * 演習の`chapterId`(必要なら明示指定の`vfsSnapshotId`)から、使用すべきVFSスナップショットを解決する。
 * 該当するスナップショットが登録されていない場合は`default`にフォールバックする。
 */
export function getVfsSnapshot(chapterId: string, vfsSnapshotId?: string): VfsSnapshot {
  return vfsSnapshots[vfsSnapshotId ?? chapterId] ?? vfsSnapshots.default;
}
