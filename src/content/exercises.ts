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
  /** 不正解時に模範解答とあわせて表示する、教科書相当の解説文。 */
  explanation?: string;
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
    explanation:
      "pwd(Print Working Directory)は、シェルが今どのディレクトリにいるかを絶対パスで表示するコマンドです。" +
      "引数を取らず、実行するだけでカレントディレクトリの絶対パスを出力します。cdでディレクトリを移動したあとに" +
      "現在地を見失った場合など、作業の起点を確認するために頻繁に使います。",
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
    explanation:
      "シェルスクリプトに渡された引数は $1, $2, ... という位置パラメータで参照できます。" +
      "また、wc -l はファイル名を指定しなければ標準入力を読み込んで行数を数えるため、" +
      "パイプやリダイレクトで渡されたデータの行数をそのまま数えるのに使えます。" +
      "この演習ではecho \"Hello, $1!\"で挨拶したあと、wc -lで標準入力の行数を数えて出力します。",
  },
];
