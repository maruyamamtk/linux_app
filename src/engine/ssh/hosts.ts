import { createDirectory, createFile } from "../vfs";
import type { VfsSnapshot } from "../vfs";
import type { RemoteHostDefinition } from "./types";

const REMOTE_BASHRC = `# .bashrc (webserver)
alias ll='ls -l'
export PS1='[\\u@webserver \\W]\\$ '
`;

const NGINX_ACCESS_LOG = `203.0.113.5 - - [12/Jan/2024:09:12:03 +0900] "GET / HTTP/1.1" 200 612
203.0.113.5 - - [12/Jan/2024:09:12:05 +0900] "GET /favicon.ico HTTP/1.1" 404 217
198.51.100.23 - - [12/Jan/2024:09:15:41 +0900] "GET /api/status HTTP/1.1" 200 48
`;

const DEPLOY_README = `# webserver デプロイ手順

1. ローカルで変更をコミットする
2. このリモートホスト上で \`git pull\` する
3. \`systemctl restart nginx\` でWebサーバーを再起動する

このファイルはローカル環境には存在しません。ssh接続でこのホストに
切り替わっていることを確認するためのファイルです。
`;

function buildWebserverSnapshot(): VfsSnapshot {
  const root = createDirectory(
    "",
    {
      etc: createDirectory(
        "etc",
        {
          hostname: createFile("hostname", "webserver\n", {
            owner: "root",
            group: "root",
            mode: 0o644,
          }),
        },
        { owner: "root", group: "root", mode: 0o755 },
      ),
      var: createDirectory(
        "var",
        {
          log: createDirectory(
            "log",
            {
              nginx: createDirectory(
                "nginx",
                {
                  "access.log": createFile("access.log", NGINX_ACCESS_LOG, {
                    owner: "root",
                    group: "root",
                    mode: 0o644,
                  }),
                },
                { owner: "root", group: "root", mode: 0o755 },
              ),
            },
            { owner: "root", group: "root", mode: 0o755 },
          ),
        },
        { owner: "root", group: "root", mode: 0o755 },
      ),
      home: createDirectory(
        "home",
        {
          study: createDirectory(
            "study",
            {
              ".bashrc": createFile(".bashrc", REMOTE_BASHRC, {
                owner: "study",
                group: "study",
                mode: 0o644,
              }),
              deploy: createDirectory(
                "deploy",
                {
                  "README.md": createFile("README.md", DEPLOY_README, {
                    owner: "study",
                    group: "study",
                    mode: 0o644,
                  }),
                },
                { owner: "study", group: "study", mode: 0o755 },
              ),
            },
            { owner: "study", group: "study", mode: 0o755 },
          ),
        },
        { owner: "root", group: "root", mode: 0o755 },
      ),
    },
    { owner: "root", group: "root", mode: 0o755 },
  );

  return { id: "remote-webserver-seed", description: "付録(ssh)演習用の仮想リモートホストVFS", root };
}

/**
 * `ssh`コマンドが接続できる、固定の仮想リモートホスト一覧(docs/requirements.md 付録行)。
 * 実ネットワーク通信は行わず、ここに登録されたホスト名に一致した場合のみ接続をシミュレートする。
 */
export const REMOTE_HOSTS: Readonly<Record<string, RemoteHostDefinition>> = {
  webserver: {
    host: "webserver",
    promptHost: "webserver",
    banner:
      "The authenticity of host 'webserver (203.0.113.10)' can't be established.\n" +
      "ECDSA key fingerprint is SHA256:x7fQdV3n2m1z9y0aK6bR8pW4tL5cJ2hU1sN3vE9oQr0.\n" +
      "Are you sure you want to continue connecting (yes/no/[fingerprint])? yes\n" +
      "Warning: Permanently added 'webserver' (ECDSA) to the list of known hosts.\n" +
      "Last login: Mon Jan  1 09:00:00 2024 from 203.0.113.5\n",
    snapshot: buildWebserverSnapshot(),
    homeDir: "/home/study",
  },
};

/** ホスト名(`ssh user@host`の"host"部分)から、登録済みの仮想リモートホスト定義を検索する。 */
export function findRemoteHost(host: string): RemoteHostDefinition | undefined {
  return REMOTE_HOSTS[host];
}
