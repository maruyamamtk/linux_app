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
];
