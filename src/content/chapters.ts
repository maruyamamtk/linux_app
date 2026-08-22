export type Chapter = {
  id: string;
  title: string;
  phase: 1 | 2;
  /** ユニット詳細画面の冒頭に表示する、教科書の要約を再構成したミニ解説文。 */
  description: string;
};

export const chapters: Chapter[] = [
  {
    id: "ch02-03",
    title: "シェルの基礎とキー操作クイズ",
    phase: 1,
    description:
      "シェルはユーザーの入力を解釈してカーネルに処理を依頼し、結果を表示するプログラムであることを理解する。" +
      "Ctrl+a/e/k/y等、GNU Readlineによる行編集のキー操作を選択式クイズで確認する(実機のターミナル操作は伴わない)。",
  },
  {
    id: "ch04-06",
    title: "ファイル操作の基本",
    phase: 1,
    description:
      "pwd/cd/lsで現在地とディレクトリ内を確認し、mkdir/touch/rm/cp/mvでファイルやディレクトリを操作する。" +
      "find/locate/whichでファイルやコマンドの場所を探し、manでコマンドの使い方を調べる基本操作を身につける。",
  },
  {
    id: "ch07",
    title: "Vimエディタ",
    phase: 2,
    description:
      "モーダルエディタVimの基本操作を、専用のVim演習画面(ノーマル/インサート/コマンドラインモード)で練習する。" +
      "dd/yy/pによる行の削除・ヤンク・貼り付けや、:%s/old/new/gによる置換など、書籍Ch7で扱う操作を仮想バッファ上で体験する。",
  },
  {
    id: "ch08",
    title: "エイリアスと環境変数",
    phase: 1,
    description:
      "aliasでよく使うコマンドに短い別名を付け、環境変数やPATHの仕組みを理解する。" +
      "~/.bashrcに設定を書いておくことで、シェルを起動するたびに自分好みの環境を再現できるようになる。",
  },
  {
    id: "ch09",
    title: "パーミッション",
    phase: 1,
    description:
      "ファイル・ディレクトリの所有者/グループ/その他に対する読み書き実行権限を、シンボルモード・数値モードのchmodで変更する。" +
      "su/sudoによる仮想的な権限昇格も扱い、権限エラーが起きる理由を体感する。",
  },
  {
    id: "ch10",
    title: "プロセスとジョブ管理",
    phase: 1,
    description:
      "psでプロセスの一覧を確認し、jobs/fg/bgでバックグラウンド・停止中のジョブを制御する。" +
      "killでプロセスやジョブを終了させる操作を、あらかじめ用意されたモックのプロセス一覧に対して練習する。",
  },
  {
    id: "ch11-14",
    title: "パイプラインとテキスト処理・正規表現",
    phase: 1,
    description:
      "リダイレクト(> >> 2>)とパイプ(|)でコマンドを組み合わせ、wc/sort/uniq/cutでテキストを加工する。" +
      "grepと正規表現でパターンに一致する行を検索し、sed/awkによる置換・フィールド抽出・集計までを一通り練習する。",
  },
  {
    id: "ch15-17",
    title: "シェルスクリプト作成",
    phase: 1,
    description:
      "shebangとchmod +xでスクリプトを実行可能にし、変数・クォート・コマンド置換・位置パラメータを使ったスクリプトを書く。" +
      "if/for/case/whileの制御構造とlocal変数・再帰を使う関数、IFS、xargs、ヒアドキュメントまでを一通り練習する。",
  },
  {
    id: "ch18",
    title: "アーカイブとバックアップ",
    phase: 2,
    description:
      "tarでディレクトリを1つのアーカイブファイルにまとめ、-z/-jオプションでgzip/bzip2による圧縮を同時に行う。" +
      "gzip/gunzip・bzip2/bunzip2で個々のファイルを圧縮・伸長し、zip/unzipでの圧縮・展開・一覧表示までを" +
      "複数ファイルからなるサンプルプロジェクトに対して一通り練習する。",
  },
  {
    id: "ch19",
    title: "Gitによるバージョン管理",
    phase: 2,
    description:
      "専用のGit演習画面(コミットグラフの可視化+コマンド入力)を使って、git init/add/commit/statusで" +
      "変更を記録し、git logで履歴を確認する基本操作を練習する。branch/checkoutでブランチを分けて作業し、" +
      "mergeでfast-forward・非衝突な3-wayマージの2パターンを取り込む。remote add/push/pullでは、" +
      "ローカルに置いたもう1つのリポジトリを疑似リモートに見立て、ネットワーク通信を伴わない形で" +
      "変更のやり取りを体験する。",
  },
  {
    id: "ch20",
    title: "パッケージ管理(dnf/apt)",
    phase: 2,
    description:
      "RedHat系のdnf、Debian系のaptという2つのパッケージ管理コマンドを使って、固定の仮想パッケージリポジトリに" +
      "対するsearch(検索)・info(詳細確認)・install(インストール)を練習する。installはroot権限を要求するため、" +
      "sudo/suによる権限昇格や、依存パッケージの自動解決も合わせて体験する。",
  },
  {
    id: "appendix",
    title: "付録: SSH接続・infoコマンド・日本語入力",
    phase: 2,
    description:
      "他のLinuxマシンへ安全に接続するためのSSH、manより詳細な情報を階層的に閲覧できるinfoコマンド、" +
      "日本語入力を可能にするIME(ibus/fcitx等)の役割を選択式クイズで確認する。あわせてsshコマンドで" +
      "固定の仮想リモートホストへ接続し、プロンプト表示の変化やホスト固有のファイルへの切り替わりを" +
      "体験したうえで、exitでローカル環境へ復帰する一連の流れを練習する。",
  },
  {
    id: "ch01",
    title: "Linux学習環境の構築(VirtualBox)",
    phase: 2,
    description:
      "ここまでのシミュレータ演習で身につけた操作を、今後実際のマシン上でも試したくなったときのための章。" +
      "仮想化ソフトウェアVirtualBoxを使って、手元のPCを壊すことなくLinux環境を試せる仮想マシン(VM)を構築する流れを理解する。" +
      "ホストOS/ゲストOSの関係やスナップショット機能など、実機を触らずに安全に学習を進めるための考え方を選択式クイズで確認する" +
      "(実際のVirtualBoxのインストール・操作は伴わない)。",
  },
];
