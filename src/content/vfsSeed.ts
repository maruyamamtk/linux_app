import { createDirectory, createFile } from "../engine/vfs";
import type { VfsNode, VfsSnapshot } from "../engine/vfs";

/**
 * 演習用VFSシードデータ。docs/requirements.md 4章のパス構造・サンプルファイルを実データ化したもの。
 * Phase1(Ch4〜17)で使用する演習ディレクトリ群を含む(Ch18以降のPhase2向けディレクトリは対象外)。
 */

function childMap(nodes: VfsNode[]): Record<string, VfsNode> {
  const result: Record<string, VfsNode> = {};
  for (const node of nodes) {
    result[node.name] = node;
  }
  return result;
}

const ROOT_OWNER = { owner: "root", group: "root" };
const STUDY_OWNER = { owner: "study", group: "study" };

function rootDir(name: string, nodes: VfsNode[], mode = 0o755) {
  return createDirectory(name, childMap(nodes), { ...ROOT_OWNER, mode });
}

function studyDir(name: string, nodes: VfsNode[], mode = 0o755) {
  return createDirectory(name, childMap(nodes), { ...STUDY_OWNER, mode });
}

function rootFile(name: string, content: string, mode = 0o644) {
  return createFile(name, content, { ...ROOT_OWNER, mode });
}

function studyFile(name: string, content: string, mode = 0o644) {
  return createFile(name, content, { ...STUDY_OWNER, mode });
}

/** /bin, /usr/bin 用のダミー実行ファイル。中身は持たず、名前・サイズ・パーミッションのみ保持する。 */
function dummyExecutable(name: string, size: number) {
  return createFile(name, "", { ...ROOT_OWNER, mode: 0o755, size });
}

const BIN_EXECUTABLES: Array<[string, number]> = [
  ["bash", 1150688],
  ["sh", 1150688],
  ["cat", 43416],
  ["cp", 174808],
  ["mv", 174808],
  ["rm", 78072],
  ["mkdir", 60112],
  ["rmdir", 43432],
  ["touch", 68216],
  ["pwd", 47272],
  ["ls", 142312],
  ["chmod", 68288],
  ["chown", 68416],
  ["echo", 43416],
  ["grep", 231448],
  ["sed", 132608],
  ["gzip", 96248],
  ["tar", 470176],
  ["ln", 68288],
  ["kill", 39424],
  ["ps", 106576],
  ["sleep", 43416],
  ["sync", 39320],
];

const USR_BIN_EXECUTABLES: Array<[string, number]> = [
  ["find", 502904],
  ["which", 34648],
  ["less", 191696],
  ["more", 47760],
  ["head", 43552],
  ["tail", 63960],
  ["sort", 100696],
  ["uniq", 51576],
  ["cut", 55112],
  ["tr", 47472],
  ["wc", 43512],
  ["diff", 209160],
  ["awk", 487304],
  ["xargs", 55208],
  ["man", 138224],
  ["vim", 3416480],
  ["python3", 6193968],
  ["perl", 2313928],
  ["ssh", 962248],
  ["tee", 39320],
  ["cmp", 43608],
  ["comm", 43480],
  ["join", 68696],
  ["paste", 43448],
  ["expr", 108368],
  ["seq", 47656],
  ["basename", 39320],
  ["dirname", 39320],
  ["env", 43512],
];

const PASSWD_CONTENT = [
  "root:x:0:0:root:/root:/bin/bash",
  "bin:x:1:1:bin:/bin:/sbin/nologin",
  "daemon:x:2:2:daemon:/sbin:/sbin/nologin",
  "adm:x:3:4:adm:/var/adm:/sbin/nologin",
  "lp:x:4:7:lp:/var/spool/lpd:/sbin/nologin",
  "sync:x:5:0:sync:/sbin:/bin/sync",
  "shutdown:x:6:0:shutdown:/sbin:/sbin/shutdown",
  "halt:x:7:0:halt:/sbin:/sbin/halt",
  "mail:x:8:12:mail:/var/spool/mail:/sbin/nologin",
  "operator:x:11:0:operator:/root:/sbin/nologin",
  "games:x:12:100:games:/usr/games:/sbin/nologin",
  "ftp:x:14:50:FTP User:/var/ftp:/sbin/nologin",
  "nobody:x:99:99:Nobody:/:/sbin/nologin",
  "systemd-network:x:192:192:systemd Network Management:/:/usr/sbin/nologin",
  "dbus:x:81:81:System message bus:/:/sbin/nologin",
  "polkitd:x:999:998:User for polkitd:/:/sbin/nologin",
  "sshd:x:74:74:Privilege-separated SSH:/var/empty/sshd:/sbin/nologin",
  "chrony:x:998:996:chrony:/var/lib/chrony:/sbin/nologin",
  "tcpdump:x:72:72::/:/sbin/nologin",
  "study:x:1000:1000:study user:/home/study:/bin/bash",
].join("\n") + "\n";

const CRONTAB_CONTENT = `SHELL=/bin/bash
PATH=/sbin:/bin:/usr/sbin:/usr/bin
MAILTO=root

# For details see man 4 crontabs

# Example of job definition:
# .---------------- minute (0 - 59)
# |  .------------- hour (0 - 23)
# |  |  .---------- day of month (1 - 31)
# |  |  |  .------- month (1 - 12) OR jan,feb,mar,apr ...
# |  |  |  |  .---- day of week (0 - 6) (Sunday=0 or 7)
# |  |  |  |  |
# *  *  *  *  * user-name  command to be executed
17 *    * * *   root    cd / && run-parts --report /etc/cron.hourly
25 6    * * *   root    test -x /usr/sbin/anacron || ( cd / && run-parts --report /etc/cron.daily )
47 6    * * 7   root    test -x /usr/sbin/anacron || ( cd / && run-parts --report /etc/cron.weekly )
52 6    1 * *   root    test -x /usr/sbin/anacron || ( cd / && run-parts --report /etc/cron.monthly )
`;

const ETC_BASHRC_CONTENT = `# /etc/bashrc

# System wide functions and aliases
# Environment stuff goes in /etc/profile

if [ -z "$PS1" ]; then
   return
fi

PS1='[\\u@\\h \\W]\\$ '
export PATH USER LOGNAME MAIL HOSTNAME HISTSIZE HISTCONTROL
`;

const STUDY_BASHRC_CONTENT = `# .bashrc

# User specific aliases and functions
alias ll='ls -l'
alias la='ls -a'

# Source global definitions
if [ -f /etc/bashrc ]; then
    . /etc/bashrc
fi
`;

const STUDY_BASH_PROFILE_CONTENT = `# .bash_profile

# Get the aliases and functions
if [ -f ~/.bashrc ]; then
    . ~/.bashrc
fi

# User specific environment and startup programs
PATH=$PATH:$HOME/bin

export PATH
`;

const SAMPLE_TXT_CONTENT = "これは演習用のサンプルファイルです。\n";

const MEMO_TXT_CONTENT = `買い物リスト
- 牛乳
- パン
- 卵
`;

const TARGET_TXT_CONTENT = "ここが find の探索対象のファイルです。\n";

const SECRET_TXT_CONTENT = "これは他人に見られたくない秘密の内容です。\n";

const SCRIPT_SH_CONTENT = `#!/bin/bash
echo "Hello, World!"
`;

const OUTPUT_LOG_CONTENT = [
  "2024-01-01 10:00:01 INFO  Starting service",
  "2024-01-01 10:00:05 INFO  Listening on port 8080",
  "2024-01-01 10:01:12 WARN  High memory usage detected",
  "2024-01-01 10:02:30 ERROR Failed to connect to database",
  "2024-01-01 10:02:31 INFO  Retrying connection",
  "2024-01-01 10:02:35 INFO  Connected to database",
  "2024-01-01 10:05:00 ERROR Timeout while processing request",
  "2024-01-01 10:05:01 INFO  Request retried successfully",
  "2024-01-01 10:10:00 INFO  Service stopped",
].join("\n") + "\n";

const FILE1_TXT_CONTENT = [
  "北海道",
  "青森県",
  "東京都",
  "大阪府",
  "東京都",
  "福岡県",
  "北海道",
  "沖縄県",
  "京都府",
  "東京都",
].join("\n") + "\n";

const FILE2_TXT_CONTENT = [
  "青森県",
  "東京都",
  "大阪府",
  "愛知県",
  "福岡県",
  "北海道",
  "沖縄県",
  "京都府",
  "東京都",
  "神奈川県",
].join("\n") + "\n";

const NUMBER_TXT_CONTENT = ["5", "3", "9", "1", "7", "2", "8", "4", "6", "10"].join("\n") + "\n";

const SCORE_CSV_CONTENT = [
  "name,score",
  "Yamada,80",
  "Suzuki,65",
  "Tanaka,92",
  "Sato,74",
  "Ito,58",
  "Watanabe,88",
].join("\n") + "\n";

const DRINK_TXT_CONTENT = [
  "Beer 5.0%",
  "Wine 12.0%",
  "Whisky 40.0%",
  "Vodka 40.0%",
  "Beer 6.0%",
  "Sake 15.0%",
  "Shochu 25.0%",
  "Wine 13.5%",
  "Beer 4.5%",
  "Highball 7.0%",
].join("\n") + "\n";

const DRINK2_TXT_CONTENT = [
  "Beer,350,700",
  "Wine,750,2000",
  "Whisky,700,3000",
  "Vodka,700,1800",
  "Sake,720,2200",
].join("\n") + "\n";

const SCORE_TXT_CONTENT = [
  "Yamada 80 65 92",
  "Suzuki 65 70 58",
  "Tanaka 92 88 76",
  "Sato 74 60 81",
].join("\n") + "\n";

function buildPractice(): VfsNode[] {
  return [
    studyDir("ch04_fs", [
      studyDir("documents", []),
      studyDir("photos", []),
      studyFile("sample.txt", SAMPLE_TXT_CONTENT),
    ]),
    studyDir("ch05_fileops", [studyFile("memo.txt", MEMO_TXT_CONTENT), studyDir("backup", [])]),
    studyDir("ch06_search", [
      studyDir("deep", [
        studyDir("a", [
          studyDir("b", [studyDir("c", [studyFile("target.txt", TARGET_TXT_CONTENT)])]),
        ]),
      ]),
    ]),
    studyDir("ch09_permissions", [
      studyFile("secret.txt", SECRET_TXT_CONTENT, 0o600),
      studyFile("script.sh", SCRIPT_SH_CONTENT, 0o644),
    ]),
    studyDir("ch11_pipeline", [studyFile("output.log", OUTPUT_LOG_CONTENT)]),
    studyDir("ch12_textproc", [
      studyFile("file1.txt", FILE1_TXT_CONTENT),
      studyFile("file2.txt", FILE2_TXT_CONTENT),
      studyFile("number.txt", NUMBER_TXT_CONTENT),
      studyFile("score.csv", SCORE_CSV_CONTENT),
    ]),
    studyDir("ch13_regex", [studyFile("drink.txt", DRINK_TXT_CONTENT)]),
    studyDir("ch14_sedawk", [
      studyFile("drink2.txt", DRINK2_TXT_CONTENT),
      studyFile("score.txt", SCORE_TXT_CONTENT),
    ]),
    studyDir("ch15_17_shellscript", []),
  ];
}

function buildRoot() {
  return rootDir("", [
    rootDir("bin", BIN_EXECUTABLES.map(([name, size]) => dummyExecutable(name, size))),
    rootDir("usr", [
      rootDir("bin", USR_BIN_EXECUTABLES.map(([name, size]) => dummyExecutable(name, size))),
    ]),
    rootDir("etc", [
      rootFile("passwd", PASSWD_CONTENT),
      rootFile("crontab", CRONTAB_CONTENT),
      rootFile("bashrc", ETC_BASHRC_CONTENT),
    ]),
    rootDir("dev", [rootFile("null", "", 0o666)]),
    rootDir("home", [
      studyDir("study", [
        studyFile(".bashrc", STUDY_BASHRC_CONTENT),
        studyFile(".bash_profile", STUDY_BASH_PROFILE_CONTENT),
        studyDir("bin", []),
        studyDir("practice", buildPractice()),
      ]),
    ]),
  ]);
}

/** Phase1(Ch4〜17)の演習で使用するVFS初期スナップショット。 */
export const phase1VfsSnapshot: VfsSnapshot = {
  id: "phase1-seed",
  description: "Phase1章(Ch4〜17)の演習用VFS初期データ",
  root: buildRoot(),
};
