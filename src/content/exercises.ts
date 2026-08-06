import type { ScriptTestCase } from "../engine/grading";

export type Exercise = {
  id: string;
  chapterId: string;
  prompt: string;
  /** "terminal"(通常のターミナル演習, デフォルト)または"script"(スクリプト作成モード、Ch15-17向け)。 */
  type?: "terminal" | "script";
  /** ターミナルを開始するカレントディレクトリ。省略時は $HOME(/home/study)。 */
  initialCwd?: string;
  /** 「答え合わせ」でユーザーの入力と突き合わせる模範解答コマンド(複数行可)。type:"script"の場合は模範解答スクリプト全文。 */
  referenceSolution?: string;
  /** type:"script"の場合に、コードエディタの初期表示内容として使うテンプレート(shebang等)。 */
  initialScript?: string;
  /** type:"script"の場合の、引数・標準入力の組み合わせを変えた複数のテストケース。 */
  testCases?: ScriptTestCase[];
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
  {
    id: "ch15-17-ex01",
    chapterId: "ch15-17",
    type: "script",
    prompt:
      "1行目にshebang(#!/bin/bash)を書き、位置パラメータ $1 で渡された名前を使って" +
      "「Hello, 名前!」と挨拶したあと、標準入力から渡された行数を表示するシェルスクリプトを作成してください。",
    initialCwd: "/home/study/practice/ch15_17_shellscript",
    initialScript: "#!/bin/bash\n",
    referenceSolution: '#!/bin/bash\necho "Hello, $1!"\nwc -l\n',
    testCases: [
      { id: "tc1", description: "名前=Alice, 標準入力2行", args: ["Alice"], stdin: "apple\nbanana\n" },
      { id: "tc2", description: "名前=Bob, 標準入力なし", args: ["Bob"] },
      { id: "tc3", description: "名前=study, 標準入力3行", args: ["study"], stdin: "a\nb\nc\n" },
    ],
    hints: [
      "引数は位置パラメータ $1 で参照できます。",
      "標準入力の行数は、ファイル名を指定せずに wc -l を実行すると数えられます。",
    ],
  },
];
