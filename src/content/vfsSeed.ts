import { createDirectory, createFile } from "../engine/vfs";
import type { VfsDirectoryNode, VfsNode, VfsSnapshot } from "../engine/vfs";

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

function createPracticeDirectory(): VfsDirectoryNode {
  return createDirectory("practice", {
    ch04_fs: createDirectory("ch04_fs", {
      documents: createDirectory("documents", {}, { owner: "study", group: "study", mode: 0o755 }),
      photos: createDirectory("photos", {}, { owner: "study", group: "study", mode: 0o755 }),
      "sample.txt": createFile("sample.txt", CH04_SAMPLE_TXT, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
    }, { owner: "study", group: "study", mode: 0o755 }),

    ch05_fileops: createDirectory("ch05_fileops", {
      "memo.txt": createFile("memo.txt", CH05_MEMO_TXT, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
      backup: createDirectory("backup", {}, { owner: "study", group: "study", mode: 0o755 }),
    }, { owner: "study", group: "study", mode: 0o755 }),

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
            }, { owner: "study", group: "study", mode: 0o755 }),
          }, { owner: "study", group: "study", mode: 0o755 }),
        }, { owner: "study", group: "study", mode: 0o755 }),
      }, { owner: "study", group: "study", mode: 0o755 }),
    }, { owner: "study", group: "study", mode: 0o755 }),

    ch09_permissions: createDirectory("ch09_permissions", {
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
    }, { owner: "study", group: "study", mode: 0o755 }),

    ch11_pipeline: createDirectory("ch11_pipeline", {
      "output.log": createFile("output.log", CH11_OUTPUT_LOG, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
    }, { owner: "study", group: "study", mode: 0o755 }),

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
    }, { owner: "study", group: "study", mode: 0o755 }),

    ch13_regex: createDirectory("ch13_regex", {
      "drink.txt": createFile("drink.txt", CH13_DRINK_TXT, {
        owner: "study",
        group: "study",
        mode: 0o644,
      }),
    }, { owner: "study", group: "study", mode: 0o755 }),

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
    }, { owner: "study", group: "study", mode: 0o755 }),

    ch15_17_shellscript: createDirectory(
      "ch15_17_shellscript",
      {},
      { owner: "study", group: "study", mode: 0o755 },
    ),
  }, { owner: "study", group: "study", mode: 0o755 });
}

function createStudyHomeDirectory(): VfsDirectoryNode {
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
    bin: createDirectory("bin", {}, { owner: "study", group: "study", mode: 0o755 }),
    practice: createPracticeDirectory(),
  }, { owner: "study", group: "study", mode: 0o755 });
}

/**
 * Phase1(Ch4〜17)の演習で使う仮想ファイルシステムの初期スナップショット。
 * `study`という非rootユーザーとして開始し、`/etc`・`/bin`はroot所有・書き込み不可にすることで、
 * Ch9(パーミッション)・sudo演習の権限エラーを自然に再現する(docs/requirements.md 4章参照)。
 */
export const phase1VfsSnapshot: VfsSnapshot = {
  id: "phase1-seed",
  description: "Phase1(Ch4〜17)演習用のVFS初期シードデータ",
  root: createDirectory(
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
          study: createStudyHomeDirectory(),
        },
        { owner: "root", group: "root", mode: 0o755 },
      ),
    },
    { owner: "root", group: "root", mode: 0o755 },
  ),
};
