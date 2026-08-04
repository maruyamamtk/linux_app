export type Exercise = {
  id: string;
  chapterId: string;
  prompt: string;
  /** ターミナルを開始するカレントディレクトリ。省略時は $HOME(/home/study)。 */
  initialCwd?: string;
  /** 「答え合わせ」でユーザーの入力と突き合わせる模範解答コマンド(複数行可)。 */
  referenceSolution?: string;
  /** ヒントボタンを押すたびに1つずつ表示するヒント文言。 */
  hints?: string[];
};

export const exercises: Exercise[] = [
  {
    id: "ch04-06-ex01",
    chapterId: "ch04-06",
    prompt: "カレントディレクトリのパスを表示するコマンドを実行してください。",
    initialCwd: "/home/study/practice/ch04_fs",
    referenceSolution: "pwd",
    hints: [
      "現在地を表示するコマンドは3文字です。",
      "「Print Working Directory」の略で pwd です。",
    ],
  },
];
