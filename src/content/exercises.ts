import type { MockProcess } from "../engine/commands";
import type { ScriptTestCase } from "../engine/grading";

export type Exercise = {
  id: string;
  chapterId: string;
  prompt: string;
  /**
   * "terminal"(通常のターミナル演習, デフォルト)・"script"(スクリプト作成モード、Ch15-17向け)・
   * "quiz"(選択式クイズ、Ch2-3向け。仮想ターミナルを使わずchoices/correctChoiceIndexで正誤判定する)・
   * "vim"(Vim演習画面、Ch7向け。仮想ターミナルを使わずinitialFileText/expectedFileTextで正誤判定する)・
   * "git"(Git演習画面、Ch19向け。仮想ターミナルを再利用しつつコミットグラフパネルを追加表示する。
   * 判定は"terminal"と同じくreferenceSolutionとの`compareVfs`ベースの採点で行う、
   * docs/git-simulator-design.md 9-10章)。
   */
  type?: "terminal" | "script" | "quiz" | "vim" | "git";
  /** ターミナルを開始するカレントディレクトリ。省略時は $HOME(/home/study)。 */
  initialCwd?: string;
  /**
   * 「答え合わせ」でユーザーの入力と突き合わせる模範解答コマンド(複数行可)。type:"script"の場合は
   * 模範解答スクリプト全文。type:"vim"の場合は解説パネルに表示する模範解答のキー入力列(表示用、
   * 判定には使用しない。判定は`expectedFileText`との比較で行う)。
   */
  referenceSolution?: string;
  /** type:"script"の場合に、コードエディタの初期表示内容として使うテンプレート(shebang等)。 */
  initialScript?: string;
  /** type:"script"の場合の、引数・標準入力の組み合わせを変えた複数のテストケース。 */
  testCases?: ScriptTestCase[];
  /** ps/jobs/fg/bg/kill等を使う演習向けの、モックのプロセス一覧の初期状態(Ch10向け)。 */
  processes?: MockProcess[];
  /** type:"quiz"の場合の選択肢一覧。 */
  choices?: string[];
  /** type:"quiz"の場合の、choicesのうち正解のインデックス(0始まり)。 */
  correctChoiceIndex?: number;
  /** type:"vim"の場合の、Vimエディタの初期バッファ内容(ファイル形式、末尾改行あり)。 */
  initialFileText?: string;
  /** type:"vim"の場合の、答え合わせで比較する期待される最終バッファ内容(ファイル形式、末尾改行あり)。 */
  expectedFileText?: string;
  /** ヒントボタンを押すたびに1つずつ表示するヒント文言。 */
  hints?: string[];
  /** 不正解時に模範解答とあわせて表示する、教科書相当の解説文。 */
  explanation?: string;
};

export const exercises: Exercise[] = [
  // ---------------------------------------------------------------------
  // Ch1: Linux学習環境の構築(VirtualBox)
  // ---------------------------------------------------------------------
  {
    id: "ch01-ex01",
    chapterId: "ch01",
    type: "quiz",
    prompt: "Linuxの学習に「仮想マシン(VM)」を使うメリットとして、最も適切なものはどれですか?",
    choices: [
      "手元のPC(ホストOS)の環境を汚したり壊したりする心配なく、独立したLinux環境を試せる",
      "実機にLinuxを直接インストールするより、必ず動作が高速になる",
      "インターネット接続なしではVM自体を作成できない",
      "仮想マシンを使うと、ホストOSのファイルには一切アクセスできなくなる",
    ],
    correctChoiceIndex: 0,
    hints: [
      "VMは手元のPC上に作る「PCの中のもう一台のPC」のようなものです。",
      "壊れても困らない練習環境、という点がポイントです。",
    ],
    explanation:
      "仮想マシン(VM)は、手元のPC(ホストOS)上にソフトウェア的に作られる独立したコンピュータ環境です。" +
      "VM内でLinuxを自由に操作・設定変更しても、ホストOS本体には影響しないため、失敗を恐れずに学習できます。",
  },
  {
    id: "ch01-ex02",
    chapterId: "ch01",
    type: "quiz",
    prompt: "VirtualBoxとは何ですか?",
    choices: [
      "1台の物理PC上で仮想マシン(VM)を作成・実行するための仮想化ソフトウェア",
      "Linuxディストリビューションの一種",
      "ファイルを圧縮・解凍するためのユーティリティ",
      "テキストエディタの一種",
    ],
    correctChoiceIndex: 0,
    hints: ["VirtualBoxそのものはOSではなく、OSを動かすための「土台」を提供するソフトウェアです。"],
    explanation:
      "VirtualBoxはOracleが提供する仮想化ソフトウェアで、1台の物理PC上に複数の仮想マシン(VM)を作成し、" +
      "それぞれの中で別のOS(ゲストOS)を独立して動作させることができます。Linux学習用の環境構築でよく使われます。",
  },
  {
    id: "ch01-ex03",
    chapterId: "ch01",
    type: "quiz",
    prompt: "「ホストOS」と「ゲストOS」の関係を正しく説明しているものはどれですか?",
    choices: [
      "ホストOSは物理PC上で直接動くOS、ゲストOSはホストOS上の仮想マシン内で動くOS",
      "ホストOSとゲストOSは常に同じOSでなければならない",
      "ゲストOSはホストOSよりも常に高い権限を持つ",
      "ホストOSはゲストOSの内部にインストールされる",
    ],
    correctChoiceIndex: 0,
    hints: ["「ホスト(もてなす側)」と「ゲスト(招かれる側)」という言葉の意味から考えてみましょう。"],
    explanation:
      "ホストOSは物理PC上に直接インストールされ、VirtualBoxのような仮想化ソフトウェアを動かすOSです。" +
      "ゲストOSはその上に作られた仮想マシン(VM)の中にインストールされ、動作するOS(この場合はLinux)を指します。",
  },
  {
    id: "ch01-ex04",
    chapterId: "ch01",
    type: "quiz",
    prompt: "仮想マシンの「スナップショット」機能の説明として最も適切なものはどれですか?",
    choices: [
      "ある時点のVMの状態を保存しておき、後からその状態に戻せる機能",
      "VMの画面を1枚の画像ファイルとして保存する機能",
      "VMのネットワーク速度を計測する機能",
      "ホストOSのファイルを自動的にバックアップする機能",
    ],
    correctChoiceIndex: 0,
    hints: ["「操作を誤ってVMを壊してしまっても大丈夫」という安心感を支える機能です。"],
    explanation:
      "スナップショットは、ある時点でのVM全体の状態(ディスクの内容や設定)を保存しておく機能です。" +
      "設定変更やコマンド操作で環境を壊してしまっても、スナップショットを取得した時点まで簡単に復元できるため、" +
      "失敗を恐れずに色々なコマンドを試せる安全網になります。",
  },
  {
    id: "ch01-ex05",
    chapterId: "ch01",
    type: "quiz",
    prompt: "実機に直接Linuxをインストールする方法と比べて、VirtualBox上の仮想マシンでLinuxを学習することの利点はどれですか?",
    choices: [
      "手元のPCのOS(Windows/macOS等)を残したまま、並行してLinuxを試せる",
      "実機にインストールする場合よりも、常にディスク容量を消費しない",
      "仮想マシンでは、コマンドの実行結果が実機と異なるものになる",
      "仮想マシンを使うと、キーボードやマウスの操作を一切行わずに学習できる",
    ],
    correctChoiceIndex: 0,
    hints: ["「今使っているPCの環境を消さずに」という点が最大のメリットです。"],
    explanation:
      "実機にLinuxを直接インストールする(デュアルブート等)場合、既存のOS領域の変更やパーティション操作が必要になり" +
      "リスクを伴います。VirtualBox上の仮想マシンであれば、既存のホストOS環境をそのまま残しつつ、" +
      "その上で独立したLinux環境を安全に構築・破棄できます。",
  },

  // ---------------------------------------------------------------------
  // Ch2-3: シェルの基礎とキー操作クイズ
  // ---------------------------------------------------------------------
  {
    id: "ch02-03-ex01",
    chapterId: "ch02-03",
    type: "quiz",
    prompt: "シェルの役割として最も適切な説明はどれですか?",
    choices: [
      "ユーザーが入力したコマンドを解釈し、カーネルに処理を依頼して結果を表示するプログラム",
      "ハードウェアを直接制御し、メモリやCPUを管理するプログラム",
      "ウェブページを解析して画面に表示するプログラム",
      "ファイルを圧縮・展開する専用プログラム",
    ],
    correctChoiceIndex: 0,
    hints: [
      "「シェル(貝殻)」という名前は、中心にあるカーネルを覆う殻であることに由来します。",
      "ユーザーとOSの中核(カーネル)の橋渡し役を果たします。",
    ],
    explanation:
      "シェルはユーザーが入力したコマンドを解釈し、カーネルに処理を依頼して、その結果を表示するプログラムです。" +
      "ユーザーとカーネルの間に立つ「対話窓口」の役割を果たします。bashはシェルの実装のひとつです。",
  },
  {
    id: "ch02-03-ex02",
    chapterId: "ch02-03",
    type: "quiz",
    prompt: "ターミナル(端末)とシェルの関係について、正しい説明はどれですか?",
    choices: [
      "ターミナルはユーザーの入出力を受け持つ画面(アプリ)で、その中でシェルというプログラムが起動してコマンドを解釈する",
      "ターミナルとシェルは全く同じもので、呼び方が違うだけである",
      "シェルはハードウェアで、ターミナルはソフトウェアである",
      "ターミナルはシェルの一部の機能名である",
    ],
    correctChoiceIndex: 0,
    hints: ["ターミナルは「画面」、シェルはその画面の中で動く「プログラム」と考えると整理しやすいです。"],
    explanation:
      "ターミナル(端末)はユーザーの文字入力と出力表示を受け持つアプリケーションで、その中でシェルというプログラムが" +
      "起動し、入力されたコマンドを解釈・実行します。両者は役割の異なる別のソフトウェアです。",
  },
  {
    id: "ch02-03-ex03",
    chapterId: "ch02-03",
    type: "quiz",
    prompt: "コマンドライン編集で、カーソルを行頭に移動するキー操作はどれですか?",
    choices: ["Ctrl+a", "Ctrl+e", "Ctrl+k", "Ctrl+y"],
    correctChoiceIndex: 0,
    hints: ["「a」はアルファベットの先頭の文字です。「行の先頭」と結び付けて覚えられます。"],
    explanation:
      "Ctrl+aはGNU Readlineの行編集機能で、カーソルを行頭(beginning of line)に移動します。" +
      "対になるCtrl+eはカーソルを行末(end of line)に移動します。",
  },
  {
    id: "ch02-03-ex04",
    chapterId: "ch02-03",
    type: "quiz",
    prompt: "Ctrl+e の動作として正しいものはどれですか?",
    choices: [
      "カーソルを行末に移動する",
      "カーソルを行頭に移動する",
      "カーソル位置から行末までを削除する",
      "直前に削除した文字列を貼り付ける",
    ],
    correctChoiceIndex: 0,
    hints: ["eは「end」(終わり)の頭文字です。"],
    explanation: "Ctrl+eはカーソルを行末(end of line)に移動するキー操作です。長いコマンドを編集するときによく使います。",
  },
  {
    id: "ch02-03-ex05",
    chapterId: "ch02-03",
    type: "quiz",
    prompt: "Ctrl+k の動作として正しいものはどれですか?",
    choices: [
      "カーソル位置から行末までを削除してキルリング(バッファ)に保存する",
      "カーソル位置から行頭までを削除する",
      "現在の行全体を複製する",
      "入力中のコマンドを取り消してプロンプトに戻る",
    ],
    correctChoiceIndex: 0,
    hints: ["kは「kill」(削除)の頭文字です。削除した内容は後で貼り付けられます。"],
    explanation:
      "Ctrl+k(kill)はカーソル位置から行末までを削除し、その内容をキルリングと呼ばれるバッファに保存します。" +
      "削除した文字列はCtrl+y(yank)で貼り付けられます。",
  },
  {
    id: "ch02-03-ex06",
    chapterId: "ch02-03",
    type: "quiz",
    prompt: "Ctrl+y の動作として正しいものはどれですか?",
    choices: [
      "直前にCtrl+k等で削除した文字列を貼り付ける(ヤンク)",
      "直前のコマンドをもう一度実行する",
      "カーソル位置の1文字を削除する",
      "コマンド履歴を検索する",
    ],
    correctChoiceIndex: 0,
    hints: ["yは「yank」(引っ張り出す、貼り付ける)の頭文字です。Ctrl+kとセットで覚えましょう。"],
    explanation:
      "Ctrl+y(yank)は、直前にCtrl+k等で削除してキルリングに保存された文字列をカーソル位置に貼り付けます。",
  },
  {
    id: "ch02-03-ex07",
    chapterId: "ch02-03",
    type: "quiz",
    prompt: "コマンド履歴をさかのぼって、入力したキーワードを含むコマンドをインクリメンタルに検索するキー操作はどれですか?",
    choices: ["Ctrl+r", "Ctrl+p", "Ctrl+n", "Ctrl+f"],
    correctChoiceIndex: 0,
    hints: ["rは「reverse-search」(逆順検索)の頭文字です。"],
    explanation:
      "Ctrl+rはreverse-search-historyの機能を呼び出し、入力したキーワードを含む直近のコマンドを履歴から" +
      "インクリメンタルに検索します。Ctrl+p/Ctrl+nはそれぞれ1つ前/次の履歴コマンドへの移動に使います。",
  },

  // ---------------------------------------------------------------------
  // Ch4-6: ファイル操作の基本
  // ---------------------------------------------------------------------
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
    id: "ch04-06-ex02",
    chapterId: "ch04-06",
    prompt: "ホームディレクトリの中身を、「.」で始まる隠しファイルも含めてすべて表示してください。",
    initialCwd: "/home/study",
    referenceSolution: "ls -a",
    hints: ["ls に -a オプションを付けると隠しファイルも表示されます。"],
    explanation:
      "ls はディレクトリの中身を一覧表示するコマンドですが、デフォルトでは「.」から始まる隠しファイルは表示されません。" +
      "-a(all)オプションを付けることで、隠しファイルを含むすべてのエントリを表示できます。",
  },
  {
    id: "ch04-06-ex03",
    chapterId: "ch04-06",
    prompt: "photos ディレクトリの下に、2024/summer というネストしたディレクトリを一度のコマンドで作成してください。",
    initialCwd: "/home/study/practice/ch04_fs",
    referenceSolution: "mkdir -p photos/2024/summer",
    hints: ["mkdir に -p オプションを付けると、存在しない親ディレクトリもまとめて作成できます。"],
    explanation:
      "mkdir は通常、親ディレクトリが存在しないとエラーになります。-p(parents)オプションを付けることで、" +
      "途中の階層が無くてもまとめて作成できます。",
  },
  {
    id: "ch04-06-ex04",
    chapterId: "ch04-06",
    prompt: "memo.txt を、同じディレクトリ内の backup フォルダにコピーしてください。",
    initialCwd: "/home/study/practice/ch05_fileops",
    referenceSolution: "cp memo.txt backup/",
    hints: [
      "cp コピー元 コピー先 の形式で使います。",
      "コピー先にディレクトリを指定すると、その中に同じ名前でコピーされます。",
    ],
    explanation:
      "cp はファイルをコピーするコマンドです。コピー先としてディレクトリを指定すると、元のファイル名のままそのディレクトリの中にコピーされます。",
  },
  {
    id: "ch04-06-ex05",
    chapterId: "ch04-06",
    prompt: "memo.txt を note.txt という名前に変更してください。",
    initialCwd: "/home/study/practice/ch05_fileops",
    referenceSolution: "mv memo.txt note.txt",
    hints: ["mv は移動先を同じディレクトリ内の別名にすると、ファイルの改名として働きます。"],
    explanation:
      "mv はファイルを移動するコマンドですが、移動先が同じディレクトリ内の別名であれば、実質的にファイルの改名として働きます。",
  },
  {
    id: "ch04-06-ex06",
    chapterId: "ch04-06",
    prompt: "カレントディレクトリ以下から、target.txt という名前のファイルを再帰的に検索してください。",
    initialCwd: "/home/study/practice/ch06_search",
    referenceSolution: "find . -name target.txt",
    hints: [
      "find [パス] -name [パターン] で名前による検索ができます。",
      "カレントディレクトリから検索するには . を指定します。",
    ],
    explanation:
      "find はディレクトリツリーを再帰的にたどってファイルを検索するコマンドです。-name オプションでファイル名の" +
      "パターンを指定できます。deep/a/b/c/target.txt のような深い階層にあるファイルも見つけ出せます。",
  },
  {
    id: "ch04-06-ex07",
    chapterId: "ch04-06",
    prompt: "ls コマンドの実体がどこにあるか、which コマンドで調べてください。",
    referenceSolution: "which ls",
    hints: ["which コマンド名 で、環境変数PATH上から実行ファイルの場所を調べられます。"],
    explanation:
      "which は環境変数PATHに列挙されたディレクトリを順に探索し、指定したコマンドの実行ファイルの場所を表示します。" +
      "「そのコマンドが実際にどこにあるファイルなのか」を確認するのに使います。",
  },
  // ---------------------------------------------------------------------
  // Ch8: エイリアスと環境変数
  // ---------------------------------------------------------------------
  {
    id: "ch08-ex01",
    chapterId: "ch08",
    prompt: "環境変数 HOME の値を表示してください。",
    referenceSolution: "echo $HOME",
    hints: [
      "環境変数の値を参照するには $変数名 と書きます。",
      "echo で変数展開した結果を表示できます。",
    ],
    explanation:
      "$HOME のように変数名の前に $ を付けると、シェルはその変数の値に置き換えてからコマンドを実行します(変数展開)。" +
      "HOMEはログインユーザーのホームディレクトリを保持する環境変数です。",
  },
  {
    id: "ch08-ex02",
    chapterId: "ch08",
    prompt: "GREETING という環境変数に Hello, Linux! という値を設定し、echoで表示してください。",
    referenceSolution: 'GREETING="Hello, Linux!"; echo $GREETING',
    hints: [
      "変数名=値 の形式(イコールの前後にスペースを入れない)で変数を設定できます。",
      "複数のコマンドは ; でつなげて1行にまとめて実行できます。",
    ],
    explanation:
      "NAME=value の形式で変数に値を代入できます(スペースを入れると別のコマンドとして解釈されてしまうので注意)。" +
      "; で区切ることで複数のコマンドを1行にまとめて順に実行できます。",
  },
  {
    id: "ch08-ex03",
    chapterId: "ch08",
    prompt: "現在の環境変数 PATH の値を表示してください。",
    referenceSolution: "echo $PATH",
    hints: ["PATHもHOMEと同じように $PATH で参照できる環境変数です。"],
    explanation:
      "PATHはコマンドを探索するディレクトリの一覧を「:」区切りで保持する環境変数です。which やシェル自身が" +
      "コマンド名からその実体を探すときに参照します。",
  },
  {
    id: "ch08-ex04",
    chapterId: "ch08",
    prompt: "$HOME/bin をPATHの先頭に追加してから、PATHの値を表示してください。",
    referenceSolution: 'PATH="$HOME/bin:$PATH"; echo $PATH',
    hints: [
      "元のPATHを失わないよう、展開結果に $PATH を含めます。",
      "新しいディレクトリを前に追加すると、同名コマンドがあった場合そちらが優先されます。",
    ],
    explanation:
      'PATH="$HOME/bin:$PATH" のように、既存の $PATH を展開結果に含めつつ新しいディレクトリを追加することで、' +
      "既存の検索パスを保ったまま独自のコマンド置き場を優先的に検索させることができます" +
      "(Ch15の自作スクリプトをコマンドとして呼び出す準備に相当します)。",
  },
  {
    id: "ch08-ex05",
    chapterId: "ch08",
    prompt: "$HOME/.bashrc の内容を表示してください。",
    referenceSolution: "cat $HOME/.bashrc",
    hints: ["$HOME はログインユーザーのホームディレクトリを表す環境変数です。"],
    explanation:
      "$HOME/.bashrc はログインシェルが起動するたびに読み込まれる設定ファイルで、エイリアスや環境変数の設定を" +
      "書いておくことで、新しいターミナルを開くたびに自分好みの環境を再現できます。",
  },
  {
    id: "ch08-ex06",
    chapterId: "ch08",
    prompt: "$HOME/.bashrc の末尾に、ls -l を実行するエイリアス ll を定義する行(alias ll='ls -l')を追記してください。",
    referenceSolution: "echo \"alias ll='ls -l'\" >> $HOME/.bashrc",
    hints: [
      "ファイルの末尾に追記するには >> を使います(> だと上書きされてしまいます)。",
      "alias 名前=コマンド の形式でエイリアスを定義します。",
    ],
    explanation:
      "alias 名前=コマンド と書くことで、コマンドに短い別名を付けられます。1回だけ実行しても次に端末を開いたときには" +
      "忘れられてしまうため、$HOME/.bashrc に追記(>>)しておくことで、シェルを起動するたびに自動的に定義されるようになります。",
  },

  // ---------------------------------------------------------------------
  // Ch9: パーミッション
  // ---------------------------------------------------------------------
  {
    id: "ch09-ex01",
    chapterId: "ch09",
    prompt: "script.sh に、所有者・グループ・その他すべてに実行権限を追加し、755(rwxr-xr-x)にしてください。",
    initialCwd: "/home/study/practice/ch09_permissions",
    referenceSolution: "chmod 755 script.sh",
    hints: [
      "数値モードでは 読み取り=4, 書き込み=2, 実行=1 を桁ごとに足し合わせます。",
      "755 は 所有者rwx(7), グループr-x(5), その他r-x(5) を意味します。",
    ],
    explanation:
      "chmod は数値モード(例: 755)またはシンボルモード(例: u+x)でパーミッションを変更できます。数値モードでは" +
      "所有者・グループ・その他の3桁それぞれに read=4/write=2/execute=1を合計した値を指定します。" +
      "755はrwxr-xr-xを意味し、script.shに実行権限を与えます。",
  },
  {
    id: "ch09-ex02",
    chapterId: "ch09",
    prompt:
      "secret.txt について、その他のユーザーからの読み書き・実行を禁止したまま、グループに読み取り権限だけを" +
      "追加してください(シンボルモードを使用してください)。",
    initialCwd: "/home/study/practice/ch09_permissions",
    referenceSolution: "chmod g+r secret.txt",
    hints: [
      "シンボルモードは 対象(u/g/o/a)+演算子(+/-/=)+権限(r/w/x) の形式で指定します。",
      "グループに読み取り権限だけを追加するので g+r です。",
    ],
    explanation:
      "シンボルモードの chmod g+r ファイル名 は、グループ(g)に読み取り権限(r)を追加(+)します。" +
      "他の対象や権限には影響しないため、その他(o)の権限は変更されず禁止されたままになります。",
  },
  {
    id: "ch09-ex03",
    chapterId: "ch09",
    prompt: "一般ユーザーでは書き込めない /etc ディレクトリに、sudo を使って newconf.txt という空ファイルを作成してください。",
    referenceSolution: "sudo touch /etc/newconf.txt",
    hints: [
      "/etc はroot所有で書き込み権限が無いため、通常のtouchでは失敗します。",
      "sudo コマンド で、そのコマンドだけを一時的にroot権限で実行できます。",
    ],
    explanation:
      "study ユーザーは /etc の書き込み権限を持たないため、touch /etc/newconf.txt はそのままでは" +
      "「Permission denied」になります。sudo を先頭に付けることで、そのコマンド1つだけをroot権限で実行し、" +
      "権限エラーを回避できます。",
  },
  {
    id: "ch09-ex04",
    chapterId: "ch09",
    prompt:
      "su コマンドでrootユーザーに切り替えたうえで、/etc/afterSu.txt という空ファイルを作成してください" +
      "(1行のコマンドとして ; でつないでください)。",
    referenceSolution: "su root; touch /etc/afterSu.txt",
    hints: [
      "su [ユーザー名] で以後のコマンドを実行するユーザーを切り替えられます(省略時はroot)。",
      "; で複数のコマンドを1行にまとめて順番に実行できます。",
    ],
    explanation:
      "su はセッションの実行ユーザーそのものを切り替えます(sudoと違い、以後のコマンドはすべて切り替え後の" +
      "ユーザーとして実行され続けます)。su root; touch /etc/afterSu.txt のように ; でつなぐことで、rootへの" +
      "切り替えとファイル作成を1行で実行できます。",
  },

  // ---------------------------------------------------------------------
  // Ch10: プロセスとジョブ管理
  // ---------------------------------------------------------------------
  {
    id: "ch10-ex01",
    chapterId: "ch10",
    prompt: "自分(study)が所有するプロセスの一覧を表示してください。",
    referenceSolution: "ps",
    processes: [
      { pid: 1001, command: "bash", status: "running", owner: "study" },
      { pid: 1002, command: "vim memo.txt", status: "running", owner: "study" },
      { pid: 2001, command: "sshd", status: "running", owner: "root" },
    ],
    hints: ["ps はデフォルトで自分が所有するプロセスのみを一覧表示します。"],
    explanation:
      "ps はプロセスの一覧を表示するコマンドです。オプションを付けずに実行すると、自分が所有するプロセスのみが" +
      "表示されます。root所有のプロセス(sshd等)は含まれません。",
  },
  {
    id: "ch10-ex02",
    chapterId: "ch10",
    prompt: "自分以外のユーザーが所有するプロセスも含め、全ユーザーのプロセス一覧を表示してください。",
    referenceSolution: "ps -e",
    processes: [
      { pid: 1001, command: "bash", status: "running", owner: "study" },
      { pid: 1002, command: "vim memo.txt", status: "running", owner: "study" },
      { pid: 2001, command: "sshd", status: "running", owner: "root" },
    ],
    hints: ["-e(または-a/-A)オプションを付けると全ユーザーのプロセスを表示できます。"],
    explanation:
      "ps -e(-a・-Aも同様)を指定すると、自分以外のユーザーが所有するプロセスも含めた全プロセスの一覧を表示します。",
  },
  {
    id: "ch10-ex03",
    chapterId: "ch10",
    prompt: "PID 1002 のプロセスを終了させてください。",
    referenceSolution: "kill 1002",
    processes: [
      { pid: 1001, command: "bash", status: "running", owner: "study" },
      { pid: 1002, command: "sleep 100", status: "running", owner: "study" },
    ],
    hints: ["kill PID で指定したプロセスを終了できます。"],
    explanation:
      "kill はPID(またはジョブ番号 %N)を指定してプロセスを終了させるコマンドです。root以外のユーザーは" +
      "自分が所有するプロセスしか終了できません。",
  },
  {
    id: "ch10-ex04",
    chapterId: "ch10",
    prompt: "jobsコマンドでジョブ一覧を確認したうえで、停止中のジョブ%1をバックグラウンドで再開してください。",
    referenceSolution: "bg %1",
    processes: [{ pid: 3001, jobId: 1, command: "sleep 300 &", status: "stopped", owner: "study" }],
    hints: [
      "jobs で現在のジョブ一覧と番号を確認できます。",
      "bg %番号 で停止中のジョブをバックグラウンドで再開します。",
    ],
    explanation:
      "Ctrl+zで停止したジョブは jobs で確認でき、bg %番号でバックグラウンド実行として再開できます。" +
      "フォアグラウンドに戻したい場合は fg %番号 を使います。",
  },

  // ---------------------------------------------------------------------
  // Ch11-14: パイプラインとテキスト処理・正規表現
  // ---------------------------------------------------------------------
  {
    id: "ch11-14-ex01",
    chapterId: "ch11-14",
    prompt: "存在しない no_such_file.txt を cat しようとしたときに出るエラーメッセージを画面に表示させず、/dev/null に捨ててください。",
    initialCwd: "/home/study/practice/ch11_pipeline",
    referenceSolution: "cat no_such_file.txt 2>/dev/null",
    hints: [
      "標準エラー出力はファイルディスクリプタ番号2です。",
      "2>ファイル名 でエラー出力だけをリダイレクトできます。",
    ],
    explanation:
      "2>/dev/null は標準エラー出力(fd2)を /dev/null にリダイレクトする書き方です。/dev/null は書き込んだ内容を" +
      "すべて破棄する特殊ファイルなので、エラーメッセージを画面に表示せずに済ませられます。",
  },
  {
    id: "ch11-14-ex02",
    chapterId: "ch11-14",
    prompt: "output.log の内容を wc -l に渡して、行数を数えてください(パイプを使用)。",
    initialCwd: "/home/study/practice/ch11_pipeline",
    referenceSolution: "cat output.log | wc -l",
    hints: ["| (パイプ)は左側のコマンドの標準出力を右側のコマンドの標準入力に渡します。"],
    explanation:
      "パイプ(|)を使うと、あるコマンドの標準出力を別のコマンドの標準入力として直接つなぐことができます。" +
      "cat output.log | wc -l は output.log の内容を wc -l に渡して行数を数えます。",
  },
  {
    id: "ch11-14-ex03",
    chapterId: "ch11-14",
    prompt: "output.log からERRORを含む行だけを抽出し、その行数を数えてください。",
    initialCwd: "/home/study/practice/ch11_pipeline",
    referenceSolution: "grep ERROR output.log | wc -l",
    hints: [
      "grep パターン ファイル でパターンに一致する行を抽出できます。",
      "抽出結果をパイプで wc -l に渡すと件数が数えられます。",
    ],
    explanation:
      "grep ERROR output.log でERRORを含む行のみを抽出し、その結果をパイプで wc -l に渡すことで、該当する行の" +
      "件数を数えられます。",
  },
  {
    id: "ch11-14-ex04",
    chapterId: "ch11-14",
    prompt: 'output.log の末尾に "2024-01-01 10:00:30 INFO Done" という行を追記してください。',
    initialCwd: "/home/study/practice/ch11_pipeline",
    referenceSolution: 'echo "2024-01-01 10:00:30 INFO Done" >> output.log',
    hints: ["> は上書き、>> は追記です。", "echo の出力をファイルへリダイレクトできます。"],
    explanation:
      "> はファイルを上書き(無ければ新規作成、あれば内容を空にしてから書き込み)しますが、>> は既存の内容を" +
      "残したまま末尾に追記します。ログファイルへの書き込みでは通常 >> を使います。",
  },
  {
    id: "ch11-14-ex05",
    chapterId: "ch11-14",
    prompt: "file1.txt の内容を並び替えたうえで、重複する行をまとめて表示してください。",
    initialCwd: "/home/study/practice/ch12_textproc",
    referenceSolution: "sort -u file1.txt",
    hints: ["sort に -u オプションを付けると、並び替えと同時に重複行をまとめられます。"],
    explanation:
      "sort -u は各行を並び替えたうえで、重複する行をひとつにまとめて表示します(uniqと違い、あらかじめ" +
      "sortされていない入力にも対応できます)。",
  },
  {
    id: "ch11-14-ex06",
    chapterId: "ch11-14",
    prompt: "number.txt の内容を数値として昇順に並び替えて表示してください。",
    initialCwd: "/home/study/practice/ch12_textproc",
    referenceSolution: "sort -n number.txt",
    hints: [
      "文字列としての並び替えでは 10 が 2 より前に来てしまいます。",
      "-n オプションを付けると数値として比較して並び替えられます。",
    ],
    explanation:
      "sort はデフォルトでは文字列として辞書順に比較するため、\"10\"が\"2\"より前に来るなど直感に反する結果に" +
      "なります。-n(numeric-sort)オプションを付けることで、各行を数値として比較して並び替えられます。",
  },
  {
    id: "ch11-14-ex07",
    chapterId: "ch11-14",
    prompt: "score.csv から name と score の列(1列目と2列目)だけを、カンマ区切りのまま抽出してください。",
    initialCwd: "/home/study/practice/ch12_textproc",
    referenceSolution: "cut -d, -f1,2 score.csv",
    hints: [
      "cut -d 区切り文字 -f フィールド番号 で列を切り出せます。",
      "score.csv はカンマ区切りなので -d, を指定します。",
    ],
    explanation:
      "cut は区切り文字(-d)で行を分割し、指定したフィールド番号(-f)のみを抽出するコマンドです。score.csv は" +
      "カンマ区切りのCSVなので、-d, -f1,2 で1列目・2列目(nameとscore)だけを抽出できます。",
  },
  {
    id: "ch11-14-ex08",
    chapterId: "ch11-14",
    prompt: "file1.txt と file2.txt をあわせてソートし、それぞれの都道府県名が何回登場するか集計してください。",
    initialCwd: "/home/study/practice/ch12_textproc",
    referenceSolution: "cat file1.txt file2.txt | sort | uniq -c",
    hints: [
      "uniq は隣接する重複行しかまとめられないため、事前に sort しておく必要があります。",
      "-c オプションを付けると出現回数を数えられます。",
    ],
    explanation:
      "uniq は連続する同じ内容の行をまとめるコマンドですが、離れた場所にある重複行はまとめられないため、事前に" +
      "sortしておく必要があります。cat file1.txt file2.txt | sort | uniq -c で2つのファイルを結合・ソートした" +
      "うえで、各行の出現回数を集計できます。",
  },
  {
    id: "ch11-14-ex09",
    chapterId: "ch11-14",
    prompt: 'drink.txt から、大文字小文字を区別せずに "beer" を含む行を検索してください。',
    initialCwd: "/home/study/practice/ch13_regex",
    referenceSolution: "grep -i beer drink.txt",
    hints: ["-i オプションを付けると大文字小文字を区別せずに検索できます。"],
    explanation:
      "grep -i パターン ファイル は、大文字小文字を区別せずにパターンマッチングを行います。drink.txtには" +
      "\"Beer\"という表記のみですが、-iを付けることで\"beer\"や\"BEER\"といった表記でも一致させられます。",
  },
  {
    id: "ch11-14-ex10",
    chapterId: "ch11-14",
    prompt: "drink.txt から、BeerまたはWineのみの行を拡張正規表現で検索してください。",
    initialCwd: "/home/study/practice/ch13_regex",
    referenceSolution: 'grep -E "^(Beer|Wine)$" drink.txt',
    hints: [
      "-E オプションで拡張正規表現(ERE)が使えるようになり、( ) や | がそのままグループ化・選択の意味を持ちます。",
      "^ は行頭、$ は行末を表すメタ文字です。",
    ],
    explanation:
      "grep -E は拡張正規表現(ERE)を有効にするオプションで、( ) によるグループ化や | による選択(OR)が" +
      "バックスラッシュなしで使えます。^(Beer|Wine)$ は「行全体がBeerまたはWineに一致する」ことを表します。",
  },
  {
    id: "ch11-14-ex11",
    chapterId: "ch11-14",
    prompt: "drink.txt から、Beerを含まない行だけを表示してください。",
    initialCwd: "/home/study/practice/ch13_regex",
    referenceSolution: "grep -v Beer drink.txt",
    hints: ["-v オプションを付けると、パターンに一致しない行だけを表示します(反転)。"],
    explanation: "grep -v パターン ファイル は、パターンに一致しない行だけを表示する「反転検索」です。",
  },
  {
    id: "ch11-14-ex12",
    chapterId: "ch11-14",
    prompt: "drink2.txt 内の Japan を 日本 に置換して表示してください(元のファイルは変更しないでください)。",
    initialCwd: "/home/study/practice/ch14_sedawk",
    referenceSolution: "sed 's/Japan/日本/' drink2.txt",
    hints: ["sed 's/置換前/置換後/' ファイル で最初に見つかった箇所を置換できます。"],
    explanation:
      "sed の s/// コマンドは、正規表現にマッチした部分を置換前→置換後で置き換えます。デフォルトでは各行の" +
      "最初の一致箇所のみ置換されます(すべて置換するにはgフラグを付けて s/Japan/日本/g とします)。sedは結果を" +
      "標準出力に表示するだけで、元のファイルは変更しません。",
  },
  {
    id: "ch11-14-ex13",
    chapterId: "ch11-14",
    prompt: "drink2.txt から、カンマ区切りの1列目(飲み物の名前)だけを awk で抽出してください。",
    initialCwd: "/home/study/practice/ch14_sedawk",
    referenceSolution: "awk -F, '{print $1}' drink2.txt",
    hints: ["awk -F 区切り文字 でフィールドの区切りを指定します。", "$1 は1列目のフィールドを表します。"],
    explanation:
      "awk -F, で区切り文字をカンマに設定し、{print $1} で各行の1列目のフィールドだけを出力します。$0は行全体、" +
      "$1〜$NFが各フィールドに対応します。",
  },
  {
    id: "ch11-14-ex14",
    chapterId: "ch11-14",
    prompt: "score.txt の各行の2列目(1回目の点数)の合計を awk で計算して表示してください。",
    initialCwd: "/home/study/practice/ch14_sedawk",
    referenceSolution: "awk '{sum += $2} END {print sum}' score.txt",
    hints: [
      "awk では変数に値を蓄積しながら各行を処理できます(例: sum += $2)。",
      "END{...} はすべての行を処理し終えたあとに一度だけ実行されます。",
    ],
    explanation:
      "awk は1行ずつ読み込みながらパターンに応じたアクションを実行するテキスト処理言語です。{sum += $2}で" +
      "各行の2列目を変数sumに加算していき、END{print sum}で全行処理後にその合計を出力します。",
  },

  // ---------------------------------------------------------------------
  // Ch15-17: シェルスクリプト作成
  // ---------------------------------------------------------------------
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
  {
    id: "ch15-17-ex02",
    chapterId: "ch15-17",
    type: "script",
    prompt:
      "位置パラメータ $1 で渡された整数が偶数か奇数かを判定し、「偶数です」または「奇数です」と表示するシェルスクリプトを作成してください。",
    initialCwd: "/home/study/practice/ch15_17_shellscript",
    initialScript: "#!/bin/bash\n",
    referenceSolution: '#!/bin/bash\nn=$1\nif [ $((n % 2)) -eq 0 ]; then\n  echo "偶数です"\nelse\n  echo "奇数です"\nfi\n',
    testCases: [
      { id: "tc1", description: "引数=4(偶数)", args: ["4"] },
      { id: "tc2", description: "引数=7(奇数)", args: ["7"] },
      { id: "tc3", description: "引数=0(偶数)", args: ["0"] },
    ],
    hints: [
      "先に n=$1 のように別の変数へ受け取っておくと、以降の算術式で扱いやすくなります。",
      "算術展開 $(( )) を使うと、n % 2 のような計算ができます。",
      "if [ 条件式 ]; then ... else ... fi の形式で分岐します。",
    ],
    explanation:
      "n=$1 で位置パラメータの値を変数nに代入してから、算術展開 $((n % 2)) でnを2で割った余りを計算します。" +
      "余りが0であれば偶数、そうでなければ奇数と判定できます。if [ 式 -eq 値 ]; then ... else ... fi の形式で" +
      "条件分岐を書きます。",
  },
  {
    id: "ch15-17-ex03",
    chapterId: "ch15-17",
    type: "script",
    prompt:
      "渡された引数すべての合計を計算して表示する sum という関数を定義し、スクリプトの引数をそのまま" +
      "sum関数に渡して呼び出してください。",
    initialCwd: "/home/study/practice/ch15_17_shellscript",
    initialScript: "#!/bin/bash\n",
    referenceSolution:
      '#!/bin/bash\nsum() {\n  local total=0\n  for n in $@; do\n    total=$((total + n))\n  done\n  echo $total\n}\nsum "$@"\n',
    testCases: [
      { id: "tc1", description: "引数 1 2 3", args: ["1", "2", "3"] },
      { id: "tc2", description: "引数 10 20", args: ["10", "20"] },
      { id: "tc3", description: "引数なし", args: [] },
    ],
    hints: [
      "関数は 名前() { ... } の形式で定義します。",
      "local を使うと関数内だけで有効な変数を作れます。",
      "$@ は渡されたすべての位置パラメータを表します。",
    ],
    explanation:
      "関数名() { ... } でシェル関数を定義できます。local total=0 で関数内だけの変数を作り、" +
      'for n in $@; do ... done で渡された引数をひとつずつ処理し、算術展開 $((total + n)) で合計を計算します。' +
      '"$@" をそのまま渡すことで、スクリプトの引数を関数にも引き継げます。',
  },

  // ---------------------------------------------------------------------
  // Ch18: アーカイブとバックアップ
  // ---------------------------------------------------------------------
  {
    id: "ch18-ex01",
    chapterId: "ch18",
    prompt: "project ディレクトリを project.tar という名前のtarアーカイブにまとめてください(まとめたファイルの一覧が表示されるようにしてください)。",
    initialCwd: "/home/study/practice/ch18_archive",
    referenceSolution: "tar cvf project.tar project",
    hints: [
      "tar c(create)がアーカイブの作成、v(verbose)がまとめたファイルの一覧表示、f(file)がアーカイブ名の指定です。",
      "tar cvf アーカイブ名 対象ディレクトリ の順で指定します。",
    ],
    explanation:
      "tar cvf アーカイブ名 対象... は、c(create)で新規アーカイブを作成し、v(verbose)でまとめたファイルの一覧を、" +
      "f(file)の直後に指定したアーカイブ名で保存します。ディレクトリを指定すると、その中身は再帰的にすべて" +
      "アーカイブへ含まれます。",
  },
  {
    id: "ch18-ex02",
    chapterId: "ch18",
    prompt:
      "project ディレクトリを project.tar としてアーカイブしたうえで、そのアーカイブの中身をパーミッション等の" +
      "詳細情報付きで一覧表示してください。",
    initialCwd: "/home/study/practice/ch18_archive",
    referenceSolution: "tar cf project.tar project; tar tvf project.tar",
    hints: [
      "アーカイブの中身を確認するだけなら展開(x)する必要はありません。t(list)を使います。",
      "tar tvf アーカイブ名 で、パーミッション・所有者・サイズ付きの一覧が表示できます。",
    ],
    explanation:
      "tar t(list)はアーカイブを展開せずに中身の一覧だけを確認できるオプションです。v(verbose)を付けると、" +
      "各エントリのパーミッション・所有者/グループ・サイズ・パスがls -lに似た形式で表示されます。",
  },
  {
    id: "ch18-ex03",
    chapterId: "ch18",
    prompt:
      "project ディレクトリを project.tar としてアーカイブしてから元の project ディレクトリを削除し、" +
      "アーカイブから元の内容を展開して復元してください(展開したファイル名の一覧が表示されるようにしてください)。",
    initialCwd: "/home/study/practice/ch18_archive",
    referenceSolution: "tar cf project.tar project; rm -r project; tar xvf project.tar",
    hints: [
      "先に rm -r で project ディレクトリごと削除しておきます。",
      "tar x(extract)で展開できます。v を付けると展開したファイルの一覧が表示されます。",
    ],
    explanation:
      "tar x(extract)はアーカイブの中身をカレントディレクトリ以下に展開し、元のファイル・ディレクトリ構成を" +
      "復元します。v(verbose)を付けると展開されたパスが順に表示されるため、tar cとtar xを組み合わせることで、" +
      "アーカイブがバックアップ・復元の手段として使えることを確認できます。",
  },
  {
    id: "ch18-ex04",
    chapterId: "ch18",
    prompt:
      "project ディレクトリを、tarでまとめると同時にgzip圧縮も行い、project.tar.gz として作成してください" +
      "(まとめたファイルの一覧が表示されるようにしてください)。",
    initialCwd: "/home/study/practice/ch18_archive",
    referenceSolution: "tar czvf project.tar.gz project",
    hints: [
      "z オプションを追加すると、tarでのアーカイブ作成と同時にgzip圧縮も行われます。",
      "オプションの並び順は自由なので czvf のようにまとめて指定できます。",
    ],
    explanation:
      "tar に z オプションを追加すると、アーカイブの作成(または展開)と同時にgzipによる圧縮(または伸長)が" +
      "行われます。czvf は c(作成)・z(gzip圧縮)・v(詳細表示)・f(ファイル名指定)を組み合わせたもので、" +
      "拡張子には慣習的に .tar.gz を使います。",
  },
  {
    id: "ch18-ex05",
    chapterId: "ch18",
    prompt:
      "project ディレクトリを project.tar.gz としてtar+gzipでアーカイブしてから元の project ディレクトリを" +
      "削除し、そのアーカイブから元の内容を展開して復元してください(展開したファイル名の一覧が表示されるようにしてください)。",
    initialCwd: "/home/study/practice/ch18_archive",
    referenceSolution: "tar czf project.tar.gz project; rm -r project; tar xzvf project.tar.gz",
    hints: [
      "作成時に z を付けたアーカイブは、展開するときにも z を付ける必要があります。",
      "tar xzvf アーカイブ名 で、gzip圧縮された.tar.gzアーカイブを一度に伸長・展開できます。",
    ],
    explanation:
      "z オプションで圧縮したアーカイブ(.tar.gz)は、展開時にも同じ z オプションを付けることで、gzipの伸長と" +
      "tarの展開を1つのコマンドでまとめて行えます。z を付け忘れると圧縮されたままの内容として扱われ、" +
      "正しく展開できません。",
  },
  {
    id: "ch18-ex06",
    chapterId: "ch18",
    prompt: "data.csv を gzip で圧縮してください。",
    initialCwd: "/home/study/practice/ch18_archive/project",
    referenceSolution: "gzip data.csv",
    hints: [
      "gzip ファイル名 で、そのファイルを圧縮できます。",
      "圧縮後は data.csv.gz という名前になり、元の data.csv は削除されます。",
    ],
    explanation:
      "gzip ファイル名 は指定したファイルを圧縮し、拡張子 .gz を付けた新しいファイルを作成します。tarと違い" +
      "gzipは単体では複数ファイルをまとめられず、1つのファイルだけを圧縮対象にできます。デフォルトでは圧縮後に" +
      "元のファイルは削除されます。",
  },
  {
    id: "ch18-ex07",
    chapterId: "ch18",
    prompt: "data.csv を gzip で圧縮したうえで、gunzip を使って元のファイルに戻してください。",
    initialCwd: "/home/study/practice/ch18_archive/project",
    referenceSolution: "gzip data.csv; gunzip data.csv.gz",
    hints: [
      "gunzip ファイル名.gz で、gzip圧縮されたファイルを元に戻せます。",
      "伸長後は data.csv という元のファイル名に戻り、data.csv.gz は削除されます。",
    ],
    explanation:
      "gunzip はgzipで圧縮されたファイル(.gz拡張子)を元の内容に伸長するコマンドです。gzip -d ファイル名.gz でも" +
      "同様の結果になりますが、gunzipの方が直感的な専用コマンドとしてよく使われます。",
  },
  {
    id: "ch18-ex08",
    chapterId: "ch18",
    prompt: "data.csv を bzip2 で圧縮してください。ただし、元の data.csv は削除せずに残してください。",
    initialCwd: "/home/study/practice/ch18_archive/project",
    referenceSolution: "bzip2 -k data.csv",
    hints: [
      "bzip2 はgzipと同様の使い方で、拡張子は .bz2 になります。",
      "-k(keep)オプションを付けると、圧縮後も元のファイルを削除せずに残せます。",
    ],
    explanation:
      "bzip2 はgzipよりも高い圧縮率を持つことが多い圧縮コマンドで、使い方はgzipとほぼ同じです(拡張子は .bz2)。" +
      "デフォルトでは圧縮後に元のファイルを削除しますが、-k(keep)オプションを付けることで元のファイルを" +
      "残したまま圧縮ファイルだけを追加で作成できます。",
  },
  {
    id: "ch18-ex09",
    chapterId: "ch18",
    prompt:
      "project ディレクトリを再帰的に project.zip としてzip圧縮したうえで、そのアーカイブの中身を一覧表示してください。",
    initialCwd: "/home/study/practice/ch18_archive",
    referenceSolution: "zip -r project.zip project; unzip -l project.zip",
    hints: [
      "zip はデフォルトではディレクトリの中身をたどらないため、-r(recursive)オプションが必要です。",
      "unzip -l アーカイブ名 で、展開せずに中身の一覧だけを確認できます。",
    ],
    explanation:
      "zip -r アーカイブ名 対象ディレクトリ は、-r(recursive)を付けることでディレクトリ以下のファイルを再帰的に" +
      "たどってzipアーカイブへまとめます。unzip -l アーカイブ名 は展開を行わず、アーカイブに含まれるファイルの" +
      "一覧とサイズだけを表示します。",
  },
  {
    id: "ch18-ex10",
    chapterId: "ch18",
    prompt:
      "project ディレクトリを project.zip として圧縮してから元の project ディレクトリを削除し、そのzipアーカイブを" +
      "展開して復元してください。",
    initialCwd: "/home/study/practice/ch18_archive",
    referenceSolution: "zip -r project.zip project; rm -r project; unzip project.zip",
    hints: [
      "unzip アーカイブ名 で、オプションなしで実行するとアーカイブの中身がすべて展開されます。",
      "tarと同様に、圧縮(zip)と展開(unzip)は対になるコマンドです。",
    ],
    explanation:
      "unzip アーカイブ名 はzipアーカイブに含まれるファイル・ディレクトリをカレントディレクトリ以下に展開し、" +
      "元の構成を復元します。tar/gzip/bzip2と同じく、圧縮(まとめる)コマンドと展開(元に戻す)コマンドが" +
      "対になっている点を確認できる演習です。",
  },

  // ---------------------------------------------------------------------
  // Ch7: Vimエディタ
  // ---------------------------------------------------------------------
  {
    id: "ch07-ex01",
    chapterId: "ch07",
    type: "vim",
    prompt: "ddコマンドを使って、1行目(Hello)を削除してください。",
    initialFileText: "Hello\nWorld\n",
    expectedFileText: "World\n",
    referenceSolution: "dd",
    hints: [
      "現在行を削除するには d を2回押します(dd)。",
      "カーソルは開始時点ですでに1行目にあります。",
    ],
    explanation:
      "dd はノーマルモードでカーソルがある行全体を削除し、無名レジスタへ格納するコマンドです。" +
      "d を2回連続で押すことで「現在行」という単位の操作であることを表します。",
  },
  {
    id: "ch07-ex02",
    chapterId: "ch07",
    type: "vim",
    prompt:
      "2行目(banana)にカーソルを移動し、yyでヤンクしたうえで、pでその直後(3行目の位置)に貼り付けてください。",
    initialFileText: "apple\nbanana\ncherry\n",
    expectedFileText: "apple\nbanana\nbanana\ncherry\n",
    referenceSolution: "jyyp",
    hints: [
      "j で1行下(2行目)へ移動できます。",
      "yy で現在行をヤンク(コピー)できます。",
      "p でヤンクした内容をカーソル行の下に貼り付けられます。",
    ],
    explanation:
      "yy は現在行を行単位で無名レジスタへヤンクします。行単位でヤンクされた内容を p で貼り付けると、" +
      "実vimと同じく「カーソル行の下」に新しい行として挿入されます。",
  },
  {
    id: "ch07-ex03",
    chapterId: "ch07",
    type: "vim",
    prompt: "コマンドラインモード(:)で :%s/foo/FOO/g を実行し、全行の foo を FOO に置換してください。",
    initialFileText: "foo bar\nfoo baz\n",
    expectedFileText: "FOO bar\nFOO baz\n",
    referenceSolution: ":%s/foo/FOO/g",
    hints: [
      ": でコマンドラインモードに入れます。",
      "% は全行(1,$)を表すアドレスです。",
      "末尾に g フラグを付けると、各行内の全ての一致箇所を置換できます。",
    ],
    explanation:
      ":%s/old/new/g は、% (全行)を対象に old を new へ置換するexコマンドです。s/// の間の区切り文字は" +
      "スラッシュ以外にも変更できますが、書籍Ch7ではスラッシュ区切りの :%s/old/new/g が基本形として紹介されています。",
  },
  {
    id: "ch07-ex04",
    chapterId: "ch07",
    type: "vim",
    prompt:
      "1行目の先頭で i を押してインサートモードに入り、「Hello, 」と入力したうえで Escape でノーマルモードに戻り、テキストを先頭に追加してください。",
    initialFileText: "World\n",
    expectedFileText: "Hello, World\n",
    referenceSolution: "iHello, <Esc>",
    hints: [
      "i を押すと、カーソル位置の直前からインサートモードに入れます。",
      "インサートモード中に入力した文字はそのままバッファに反映されます。",
      "入力が終わったら Escape キーでノーマルモードに戻ります。",
    ],
    explanation:
      "i はノーマルモードからインサートモードへ切り替える最も基本的なコマンドで、カーソル位置の直前から文字入力を開始します。" +
      "インサートモード中の入力はそのままテキストとして挿入され、Escape を押すとノーマルモードに復帰します。",
  },
  {
    id: "ch07-ex05",
    chapterId: "ch07",
    type: "vim",
    prompt:
      "1行目(first)と2行目(third)の間に、o で新しい行を開いてインサートモードに入り、「second」と入力したうえで Escape でノーマルモードに戻ってください。",
    initialFileText: "first\nthird\n",
    expectedFileText: "first\nsecond\nthird\n",
    referenceSolution: "osecond<Esc>",
    hints: [
      "o を押すと、現在行の下に新しい空行を作り、その行頭でインサートモードに入ります。",
      "文字を入力したら Escape でノーマルモードに戻ります。",
      "似たコマンドの O は現在行の「上」に新しい行を作ります。",
    ],
    explanation:
      "o は現在行の下に新規の空行を挿入し、その行頭からインサートモードに入るコマンドです(大文字の O は現在行の上に行を作る点が異なります)。" +
      "新しい行に文字を入力したあと Escape でノーマルモードに戻ることで、複数行にまたがる編集もノーマル/インサートモードの切り替えだけで行えます。",
  },
  {
    id: "ch07-ex06",
    chapterId: "ch07",
    type: "vim",
    prompt: "数字の 2 に続けて dd を実行し(2dd)、1行目から2行分(oneとtwo)をまとめて削除してください。",
    initialFileText: "one\ntwo\nthree\n",
    expectedFileText: "three\n",
    referenceSolution: "2dd",
    hints: ["ddの前に数字を入力すると、その行数分をまとめて削除できます。", "2dd で現在行から2行分が削除されます。"],
    explanation:
      "{count}dd のように dd の前に数字(カウント)を入力すると、現在行を含めてその行数分をまとめて削除できます。" +
      "2dd は1行目(one)から2行分、つまり one と two を削除し、残った行が繰り上がります。",
  },
  {
    id: "ch07-ex07",
    chapterId: "ch07",
    type: "vim",
    prompt: "2行目(two)にカーソルを移動して yy でヤンクしたうえで、P でその直前(2行目の上)に貼り付けてください。",
    initialFileText: "one\ntwo\nthree\n",
    expectedFileText: "one\ntwo\ntwo\nthree\n",
    referenceSolution: "jyyP",
    hints: [
      "j で1行下(2行目)へ移動できます。",
      "yy で現在行をヤンクできます。",
      "P はヤンクした内容をカーソル行の「直前」に貼り付けます(p は直後)。",
    ],
    explanation:
      "P は p と同じくレジスタの内容を貼り付けるコマンドですが、貼り付け位置がカーソル行の直前(行単位なら上の行)になる点が異なります。" +
      "yy でヤンクした two を P で貼り付けると、カーソル行だった2行目の上に新しい行として挿入されます。",
  },
  {
    id: "ch07-ex08",
    chapterId: "ch07",
    type: "vim",
    prompt:
      "コマンドラインモードで :2,3s/cat/dog/g を実行し、2行目〜3行目の cat だけを dog に置換してください(1行目は変更しないこと)。",
    initialFileText: "cat\ncat\ncat\n",
    expectedFileText: "cat\ndog\ndog\n",
    referenceSolution: ":2,3s/cat/dog/g",
    hints: [
      ": でコマンドラインモードに入れます。",
      ":{n},{m}s/old/new/g のように行番号の範囲を指定すると、その範囲だけを置換対象にできます。",
      "1行目は範囲に含めないよう注意してください。",
    ],
    explanation:
      ":%s/old/new/g がバッファ全体(1,$)を対象にするのに対し、:{n},{m}s/old/new/g のように行番号を明示すると、" +
      "n行目からm行目までの範囲だけを置換対象にできます。範囲外の行(この演習では1行目)は変更されません。",
  },

  // ---------------------------------------------------------------------
  // Ch19: Gitによるバージョン管理
  // ---------------------------------------------------------------------
  {
    id: "ch19-ex01",
    chapterId: "ch19",
    type: "git",
    prompt: "notes ディレクトリを、新しいGitリポジトリとして初期化してください。",
    initialCwd: "/home/study/practice/ch19_git/notes",
    referenceSolution: "git init",
    hints: [
      "git init を実行すると、カレントディレクトリが新しいGitリポジトリになります。",
      "リポジトリ化したいディレクトリへcdしてから実行するのが基本です(今回は既にnotesディレクトリにいます)。",
    ],
    explanation:
      "git init は、カレントディレクトリを新しいGitリポジトリとして初期化するコマンドです。実行すると .git という" +
      "隠しディレクトリが作られ、その中にオブジェクトストア(objects)・ブランチの参照(refs/heads)・現在のブランチを" +
      "指すHEAD・ステージング内容を記録するindexが用意されます。以降のadd/commit等は、この.gitディレクトリの中身を" +
      "更新していく操作になります。",
  },
  {
    id: "ch19-ex02",
    chapterId: "ch19",
    type: "git",
    prompt:
      "notes ディレクトリでリポジトリを初期化したうえで、git status を実行し、まだ何も追跡されていない状態を確認してください。",
    initialCwd: "/home/study/practice/ch19_git/notes",
    referenceSolution: "git init; git status",
    hints: [
      "git init のあと、続けて git status を実行します(; で区切って1行にまとめられます)。",
      "初期化直後は、memo.txt・todo.txtのどちらもまだGitに追跡されていない「Untracked files」として表示されます。",
    ],
    explanation:
      "git status は、ワークツリー・インデックス(ステージング状態)・直前のコミットの3者を比較し、現在のブランチ名・" +
      "ステージ済みの変更(Changes to be committed)・未ステージの変更(Changes not staged for commit)・" +
      "まだ一度もaddされていないファイル(Untracked files)を報告します。git init直後はコミットが1つも無いため、" +
      "ワークツリー上のファイルはすべてUntracked filesとして表示されます。",
  },
  {
    id: "ch19-ex03",
    chapterId: "ch19",
    type: "git",
    prompt:
      "notes ディレクトリでリポジトリを初期化し、memo.txt だけをステージングしたうえで、git status を実行して" +
      "ステージ済みの変更として表示されることを確認してください(todo.txt はまだ追跡しないでください)。",
    initialCwd: "/home/study/practice/ch19_git/notes",
    referenceSolution: "git init; git add memo.txt; git status",
    hints: [
      "git add ファイル名 で、指定したファイルだけをステージング(インデックスに追加)できます。",
      "git add . のようにディレクトリ全体を指定しない限り、指定していないファイル(todo.txt)は追跡対象になりません。",
    ],
    explanation:
      "git add ファイル名 は、指定したファイルの現在の内容をワークツリーからインデックス(ステージングエリア)へ" +
      "コピーする操作です。まだコミットはされておらず、「次にgit commitしたときに記録される内容」を確定させる" +
      "段階にすぎません。git status ではこの状態が「Changes to be committed」として表示され、addしていない" +
      "todo.txtは引き続き「Untracked files」のままです。",
  },
  {
    id: "ch19-ex04",
    chapterId: "ch19",
    type: "git",
    prompt:
      "notes ディレクトリでリポジトリを初期化し、すべてのファイルをステージングしたうえで、" +
      "「Initial commit」というメッセージでコミットしてください。",
    initialCwd: "/home/study/practice/ch19_git/notes",
    referenceSolution: 'git init; git add .; git commit -m "Initial commit"',
    hints: [
      "git add . で、カレントディレクトリ以下のすべてのファイルをまとめてステージングできます。",
      "git commit -m \"メッセージ\" で、-mオプションに続けてコミットメッセージを指定します。",
    ],
    explanation:
      "git commit -m \"メッセージ\" は、その時点のインデックスの内容から新しいコミットを作成し、現在のブランチ" +
      "(初期状態ではmain)がそのコミットを指すように更新します。-mオプションは必須で、本シミュレータでは" +
      "エディタを開く無引数のgit commitには対応していません。git add . で全ファイルをまとめてステージングして" +
      "からコミットする流れは、最初のコミット(root-commit)を作る際によく使われます。",
  },
  {
    id: "ch19-ex05",
    chapterId: "ch19",
    type: "git",
    prompt:
      "notes ディレクトリでリポジトリを初期化し、memo.txt を「Add memo」、todo.txt を「Add todo」というメッセージで" +
      "それぞれ別のコミットとして記録したうえで、git log --oneline でコミット履歴を確認してください。",
    initialCwd: "/home/study/practice/ch19_git/notes",
    referenceSolution:
      'git init; git add memo.txt; git commit -m "Add memo"; git add todo.txt; git commit -m "Add todo"; git log --oneline',
    hints: [
      "add と commit をファイルごとに1組ずつ、2回繰り返します。",
      "git log --oneline は、各コミットを「短縮ハッシュ + メッセージの1行目」の1行で新しい順に一覧表示します。",
    ],
    explanation:
      "git log は、現在のブランチが指すコミットから親をたどってコミット履歴を新しい順に表示するコマンドです。" +
      "--oneline を付けると、各コミットが「短縮ハッシュ(先頭7桁) メッセージの1行目」という1行に要約されます。" +
      "ファイルごとにadd・commitを繰り返すと、その分だけ独立したコミットが履歴に積み重なっていくことが確認できます。",
  },
  {
    id: "ch19-ex06",
    chapterId: "ch19",
    type: "git",
    prompt:
      "branch-practice ディレクトリでリポジトリを初期化し、memo.txt を「Add memo」というメッセージでコミットした" +
      "うえで、feature という名前の新しいブランチを作成してください(切り替えはまだ不要です)。",
    initialCwd: "/home/study/practice/ch19_git/branch-practice",
    referenceSolution: 'git init; git add memo.txt; git commit -m "Add memo"; git branch feature',
    hints: [
      "git branch ブランチ名 で、現在のHEADが指すコミットを指す新しいブランチを作成できます。",
      "引数無しの git branch とは異なり、ブランチ名を指定した場合はブランチの作成のみを行い、切り替えは行いません。",
    ],
    explanation:
      "git branch ブランチ名 は、現在のHEADが指しているコミットを指す新しいブランチ参照(refs/heads/ブランチ名)を" +
      "作成するだけのコマンドです。作成しただけでは現在のブランチ(この場合main)は切り替わらず、ワークツリーの" +
      "内容にも変化はありません。ブランチの実体は「特定のコミットを指すラベル」にすぎないことが確認できる演習です。",
  },
  {
    id: "ch19-ex07",
    chapterId: "ch19",
    type: "git",
    prompt:
      "branch-practice ディレクトリでリポジトリを初期化し、memo.txt を「Add memo」というメッセージでコミットして" +
      "ください。続けて git checkout -b で feature ブランチを作成・切り替えし、feature.txt というファイルに" +
      "「feature update」という内容を書き込んでから「Add feature file」というメッセージでコミットしてください。",
    initialCwd: "/home/study/practice/ch19_git/branch-practice",
    referenceSolution:
      'git init; git add memo.txt; git commit -m "Add memo"; git checkout -b feature; echo "feature update" > feature.txt; git add feature.txt; git commit -m "Add feature file"',
    hints: [
      "git checkout -b ブランチ名 は、ブランチの作成と切り替えを1つのコマンドで同時に行います。",
      "echo \"内容\" > ファイル名 で、新しい内容のファイルを作成できます。",
    ],
    explanation:
      "git checkout -b ブランチ名 は git branch ブランチ名 に続けて git checkout ブランチ名 を実行するのと同じ" +
      "効果を持つ糖衣構文です。切り替え後にfeature.txtを追加してコミットすると、この変更はfeatureブランチだけが" +
      "指す新しいコミットとして記録され、main側の履歴には影響しません。",
  },
  {
    id: "ch19-ex08",
    chapterId: "ch19",
    type: "git",
    prompt:
      "branch-practice ディレクトリでリポジトリを初期化し、memo.txt を「Add memo」というメッセージでコミットして" +
      "ください。続けて feature ブランチを作成・切り替えし、feature.txt を追加して「Add feature file」という" +
      "メッセージでコミットします。最後に main ブランチへ戻り、feature ブランチをmergeして変更を取り込んでください。",
    initialCwd: "/home/study/practice/ch19_git/branch-practice",
    referenceSolution:
      'git init; git add memo.txt; git commit -m "Add memo"; git checkout -b feature; echo "feature update" > feature.txt; git add feature.txt; git commit -m "Add feature file"; git checkout main; git merge feature',
    hints: [
      "git checkout main で、featureブランチからmainブランチへ戻れます。",
      "git merge feature を実行すると、mainがfeatureに追いついているだけの場合はfast-forward(単純にポインタを" +
        "進めるだけ)でマージされます。",
    ],
    explanation:
      "mainブランチがfeatureブランチの祖先である(mainの側に分岐後の独自コミットが無い)場合、git mergeは新しい" +
      "マージコミットを作らず、mainの参照をfeatureが指すコミットへ直接進めるだけで済みます。これをfast-forward" +
      "マージと呼びます。実行結果にはFast-forwardという文言が表示され、mainブランチのワークツリーにも" +
      "feature.txtが取り込まれます。",
  },
  {
    id: "ch19-ex09",
    chapterId: "ch19",
    type: "git",
    prompt:
      "branch-practice ディレクトリでリポジトリを初期化し、memo.txt を「Add memo」というメッセージでコミットして" +
      "ください。続けて feature ブランチを作成・切り替えて feature.txt を「Add feature note」というメッセージで" +
      "コミットし、main ブランチへ戻って main.txt を「Add main note」というメッセージでコミットしてください" +
      "(それぞれ別のファイルを追加するため、両ブランチの変更は衝突しません)。最後に main で feature をmergeして、" +
      "両方の変更を取り込んでください。",
    initialCwd: "/home/study/practice/ch19_git/branch-practice",
    referenceSolution:
      'git init; git add memo.txt; git commit -m "Add memo"; git checkout -b feature; echo "feature note" > feature.txt; git add feature.txt; git commit -m "Add feature note"; git checkout main; echo "main note" > main.txt; git add main.txt; git commit -m "Add main note"; git merge feature',
    hints: [
      "mainとfeatureの両方に、共通の祖先コミットの後で独自のコミットを積んでおくと履歴が分岐します。",
      "分岐した履歴同士をmergeすると、双方の変更を取り込んだ新しいマージコミットが作られます" +
        "(異なるファイルへの変更なので衝突しません)。",
    ],
    explanation:
      "mainとfeatureの双方が共通の祖先コミットから分岐して別々のコミットを積んでいる場合、git mergeは共通祖先の" +
      "treeを基準に双方の変更をファイル単位で比較する3-wayマージを行います。今回はmain.txtとfeature.txtという" +
      "別々のファイルへの変更なので衝突が起きず、両方の親を持つ新しいマージコミットが自動的に作成されます" +
      "(Merge made by the 'recursive' strategy.と表示されます)。マージ後のワークツリーには、main.txt・" +
      "feature.txtの両方が存在します。",
  },
  {
    id: "ch19-ex10",
    chapterId: "ch19",
    type: "git",
    prompt:
      "sync-practice ディレクトリでリポジトリを初期化し、memo.txt を「Add memo」というメッセージでコミットして" +
      "ください。続けて、1つ上の階層に sync-practice-remote という名前の別のリポジトリを疑似リモートとして用意し、" +
      "origin という名前で登録したうえで、git push でコミットを送ってください。",
    initialCwd: "/home/study/practice/ch19_git/sync-practice",
    referenceSolution:
      'git init; git add memo.txt; git commit -m "Add memo"; git init ../sync-practice-remote; git remote add origin ../sync-practice-remote; git push',
    hints: [
      "git init 対象のパス のように、パスを指定するとカレントディレクトリ以外の場所にもリポジトリを初期化できます。",
      "git remote add origin リモートのパス で、そのパスにあるリポジトリを origin という名前で登録できます。",
      "git push は、明示的な引数を省略すると origin の現在のブランチへ送ります。",
    ],
    explanation:
      "本シミュレータには実際のネットワーク通信は無いため、「もう1つのローカルリポジトリ」を疑似リモートとして" +
      "扱います。git remote add origin パス で .git/config にリモートの登録先を記録し、git push origin ブランチ名" +
      "(省略時は現在のブランチ)は、ローカル側にしかまだ無いコミット・tree・blobオブジェクトをリモート側の" +
      "オブジェクトストアへコピーしたうえで、リモート側のブランチ参照を更新します。",
  },
  {
    id: "ch19-ex11",
    chapterId: "ch19",
    type: "git",
    prompt:
      "sync-practice ディレクトリでリポジトリを初期化し、memo.txt を「Add memo」というメッセージでコミットして" +
      "ください。1つ上の階層に sync-practice-remote を疑似リモート(origin)として用意してpushしたあと、" +
      "sync-practice-remote 側へ移動して release.txt というファイルを「Add release notes」というメッセージで" +
      "直接コミットしてください。最後に sync-practice へ戻り、git pull でその変更を取り込んでください。",
    initialCwd: "/home/study/practice/ch19_git/sync-practice",
    referenceSolution:
      'git init; git add memo.txt; git commit -m "Add memo"; git init ../sync-practice-remote; git remote add origin ../sync-practice-remote; git push; cd ../sync-practice-remote; echo "release notes" > release.txt; git add release.txt; git commit -m "Add release notes"; cd ../sync-practice; git pull',
    hints: [
      "cd で疑似リモート側のディレクトリに移動すれば、そのリポジトリに対して直接add/commitできます" +
        "(疑似リモートも中身は普通のGitリポジトリです)。",
      "git pull は、リモートの新しいコミットを取り込んだうえで、fast-forward可能なら単純にブランチを進めます。",
    ],
    explanation:
      "git pull origin ブランチ名(省略時はoriginの現在のブランチ)は、リモートの新しいコミットをローカルへ" +
      "取得(fetch)したうえで、ローカルのブランチへ取り込む(merge)処理をまとめて行います。今回はローカル側に" +
      "pull前の独自コミットが無いため、取得したコミットへブランチ参照を進めるだけのfast-forwardとなり、" +
      "sync-practiceのワークツリーにrelease.txtが取り込まれます。",
  },

  // ---------------------------------------------------------------------
  // Ch20: パッケージ管理(dnf/apt)
  // ---------------------------------------------------------------------
  {
    id: "ch20-ex01",
    chapterId: "ch20",
    prompt: "curl というキーワードで、インストール可能なパッケージを dnf コマンドで検索してください。",
    referenceSolution: "dnf search curl",
    hints: [
      "dnf search キーワード で、パッケージ名や説明文にキーワードを含むパッケージを検索できます。",
      "まだインストールされていないパッケージも検索対象に含まれます。",
    ],
    explanation:
      "dnf search キーワード は、リポジトリに登録されたパッケージのうち、名前または説明(summary)に" +
      "キーワードを含むものを一覧表示します。実際にインストールするかどうかを決める前に、目的のパッケージが" +
      "存在するか・どんなパッケージか(curlの場合はlibcurl4という依存ライブラリを使うクライアント)を調べる" +
      "のに使います。",
  },
  {
    id: "ch20-ex02",
    chapterId: "ch20",
    prompt: "nginx パッケージの詳細情報(バージョン・サイズ・説明)を dnf コマンドで表示してください。",
    referenceSolution: "dnf info nginx",
    hints: [
      "dnf info パッケージ名 で、そのパッケージの詳細情報を表示できます。",
      "まだインストールしていないパッケージの場合、先頭に「Available Packages」と表示されます。",
    ],
    explanation:
      "dnf info パッケージ名 は、バージョン・アーキテクチャ・サイズ・説明などの詳細情報を表示します。" +
      "先頭の見出しが「Available Packages」か「Installed Packages」かで、そのパッケージが未インストールか" +
      "インストール済みかを区別できます。",
  },
  {
    id: "ch20-ex03",
    chapterId: "ch20",
    prompt: "sudo を使って、htop パッケージを dnf コマンドでインストールしてください。",
    referenceSolution: "sudo dnf install htop",
    hints: [
      "パッケージのインストールはシステム全体に影響するため、root権限が必要です。",
      "sudo dnf install パッケージ名 の形で実行します。",
    ],
    explanation:
      "パッケージのインストールはシステム全体の状態を変更するため、一般ユーザーのままでは" +
      "「superuser privileges」が必要というエラーになります。sudo を先頭に付けてroot権限で実行することで、" +
      "インストールが完了し、最後に「Complete!」と表示されます。",
  },
  {
    id: "ch20-ex04",
    chapterId: "ch20",
    prompt:
      "sudo を使って curl パッケージを dnf コマンドでインストールしてください。curl が依存する" +
      "libcurl4 も自動的に一緒にインストールされることを確認してください。",
    referenceSolution: "sudo dnf install curl",
    hints: [
      "dnf install は指定したパッケージだけでなく、そのパッケージが依存する他のパッケージも自動的に解決します。",
      "実行結果には「Installing:」でcurl本体、「Installing dependencies:」でlibcurl4が表示されます。",
    ],
    explanation:
      "dnf install パッケージ名 は、指定したパッケージ(この場合curl)が依存する他のパッケージ" +
      "(libcurl4)をリポジトリの依存情報から解決し、まだ入っていなければまとめてインストールします。" +
      "出力の「Installing:」には指定したパッケージ本体が、「Installing dependencies:」には自動的に" +
      "追加された依存パッケージが表示されます。",
  },
  {
    id: "ch20-ex05",
    chapterId: "ch20",
    prompt:
      "sudo を使って tree パッケージを dnf コマンドでインストールしたうえで、dnf info でインストール済みに" +
      "なったことを確認してください(1行のコマンドとして ; でつないでください)。",
    referenceSolution: "sudo dnf install tree; dnf info tree",
    hints: [
      "インストール後は sudo なしの dnf info でも、そのパッケージの情報を確認できます。",
      "インストール済みのパッケージは、dnf info の見出しが「Installed Packages」に変わります。",
    ],
    explanation:
      "インストールが完了すると、以後の dnf info パッケージ名 の見出しは「Available Packages」から" +
      "「Installed Packages」に変わります。インストール状態は仮想ファイルシステム内に記録されるため、" +
      "info・search・install のいずれのサブコマンドを使う場合でも、直前のインストール結果が反映されます。",
  },
  {
    id: "ch20-ex06",
    chapterId: "ch20",
    prompt:
      "su コマンドでrootユーザーに切り替えたうえで、mysql-server パッケージを dnf コマンドでインストールして" +
      "ください(1行のコマンドとして ; でつないでください)。",
    referenceSolution: "su root; dnf install mysql-server",
    hints: [
      "sudo は1つのコマンドだけをroot権限で実行しますが、su root は以後すべてのコマンドの実行ユーザーを" +
        "root に切り替えます。",
      "ユーザーを切り替えたあとであれば、sudo を付けずに dnf install を実行できます。",
    ],
    explanation:
      "su root で実行ユーザーをrootに切り替えたあとは、sudo を付けなくてもroot権限が必要なコマンドを" +
      "実行できます。mysql-server は mysql-common という依存パッケージを持つため、インストール結果には" +
      "依存パッケージも一緒に表示されます。",
  },
  {
    id: "ch20-ex07",
    chapterId: "ch20",
    prompt: "jq というキーワードで、インストール可能なパッケージを apt コマンドで検索してください。",
    referenceSolution: "apt search jq",
    hints: [
      "apt search キーワード で、Debian/Ubuntu系のパッケージ管理コマンドでも同様にパッケージを検索できます。",
      "1件ごとに「パッケージ名/stable バージョン amd64」の行と、その次の行に説明が表示されます。",
    ],
    explanation:
      "apt search キーワード は dnf search と同様に、パッケージ名や説明にキーワードを含むパッケージを" +
      "検索します。表示形式はdnfと異なり、1件につき「パッケージ名/stable バージョン amd64」の行と、" +
      "インデントされた説明文の2行で構成されます。",
  },
  {
    id: "ch20-ex08",
    chapterId: "ch20",
    prompt:
      "curl パッケージの詳細情報を apt コマンドで表示し、依存パッケージ(Depends)としてlibcurl4が" +
      "表示されることを確認してください。",
    referenceSolution: "apt info curl",
    hints: [
      "apt info パッケージ名 で詳細情報を表示できます。",
      "依存パッケージを持つ場合のみ、「Depends:」の行が表示されます。",
    ],
    explanation:
      "apt info パッケージ名 は、Package/Version/Installed-Size/Description等の詳細情報を表示します。" +
      "依存パッケージを持つ場合(curlの場合はlibcurl4)のみ「Depends:」の行が追加され、依存関係が無い" +
      "パッケージ(nginxなど)ではこの行自体が表示されません。",
  },
  {
    id: "ch20-ex09",
    chapterId: "ch20",
    prompt:
      "sudo を使って docker-ce パッケージを apt コマンドでインストールしてください。docker-ce が依存する" +
      "containerd も追加パッケージとして一緒にインストールされることを確認してください。",
    referenceSolution: "sudo apt install docker-ce",
    hints: [
      "aptでもdnfと同様、root権限が無いと「are you root?」のようなエラーになります。",
      "依存パッケージは「The following additional packages will be installed:」の下に表示されます。",
    ],
    explanation:
      "apt install パッケージ名 も dnf install 同様に依存関係を自動解決しますが、表示形式が異なり、" +
      "追加でインストールされる依存パッケージは「The following additional packages will be installed:」の" +
      "下に一覧表示されます。docker-ce は containerd に依存しているため、この行にcontainerdが表示されます。",
  },
  {
    id: "ch20-ex10",
    chapterId: "ch20",
    prompt:
      "sudo を使って redis-server パッケージを apt コマンドでインストールしたうえで、同じコマンドをもう一度" +
      "実行し、2回目は「既に最新バージョンがインストール済み」という趣旨のメッセージになることを確認して" +
      "ください(1行のコマンドとして ; でつないでください)。",
    referenceSolution: "sudo apt install redis-server; sudo apt install redis-server",
    hints: [
      "同じパッケージを重ねてインストールしようとしても、apt/dnfはエラーにはなりません。",
      "2回目の実行結果には「is already the newest version」という文言が含まれます。",
    ],
    explanation:
      "既にインストール済みのパッケージに対して apt install を実行すると、再インストールは行われず、" +
      "「パッケージ名 is already the newest version (バージョン).」というメッセージとともに正常終了します。" +
      "これはdnfの「is already installed」「Nothing to do.」と同じ、べき等な(何度実行しても安全な)" +
      "インストール操作を表しています。",
  },

  // ---------------------------------------------------------------------
  // 付録: SSH接続・infoコマンド・日本語入力
  // ---------------------------------------------------------------------
  {
    id: "appendix-ex01",
    chapterId: "appendix",
    type: "quiz",
    prompt: "SSH(Secure Shell)の説明として最も適切なものはどれですか?",
    choices: [
      "ネットワーク越しに別のコンピュータへ安全(暗号化された通信)にログインし、遠隔操作するための仕組み",
      "ファイルを圧縮・解凍するためのコマンド",
      "ローカルのファイルシステムを暗号化して保存するための機能",
      "Webサーバーが静的ファイルを配信するためのプロトコル",
    ],
    correctChoiceIndex: 0,
    hints: [
      "「Secure Shell」という名前の通り、通信路の安全性がポイントです。",
      "自分のPCから、別のサーバーへリモートログインする場面で使います。",
    ],
    explanation:
      "SSHは、ネットワークを介して別のコンピュータ(リモートホスト)へログインし、そこでコマンドを実行するための" +
      "プロトコルです。通信内容が暗号化されるため、同じ目的で使われていた古いtelnetと異なり、" +
      "パスワードやコマンドの内容を盗聴されるリスクを抑えられます。",
  },
  {
    id: "appendix-ex02",
    chapterId: "appendix",
    type: "quiz",
    prompt: "telnetと比較したときのSSHの利点として、最も適切なものはどれですか?",
    choices: [
      "通信内容(パスワードやコマンド・実行結果)が暗号化されるため、通信経路上で盗聴されにくい",
      "SSHはtelnetよりも常に通信速度が速い",
      "SSHは暗号化を行わない代わりに、認証を一切必要としない",
      "SSHは同一LAN内でしか利用できない",
    ],
    correctChoiceIndex: 0,
    hints: ["telnetは通信内容が平文(暗号化なし)でやり取りされる点を思い出してください。"],
    explanation:
      "telnetは通信内容を暗号化しないため、経路上でパケットを盗聴されるとパスワードや実行内容が漏えいする" +
      "リスクがあります。SSHは公開鍵暗号方式を用いて通信路そのものを暗号化するため、同じ「リモートログイン」" +
      "という目的でも安全性が大きく異なります。",
  },
  {
    id: "appendix-ex03",
    chapterId: "appendix",
    type: "quiz",
    prompt: "コマンド `ssh study@webserver` の説明として最も適切なものはどれですか?",
    choices: [
      "webserverというホストに対して、studyというユーザー名でSSHログインを試みる",
      "webserverというファイルを、studyという名前でコピーする",
      "study というホスト上で webserver コマンドを実行する",
      "SSHの設定ファイルにwebserverという行を追加する",
    ],
    correctChoiceIndex: 0,
    hints: ["`ssh [ユーザー名@]接続先ホスト名` という書式です。"],
    explanation:
      "`ssh ユーザー名@ホスト名` は、指定したホストに対して指定したユーザーとしてSSHログインするコマンドです。" +
      "ユーザー名を省略した場合は、手元の環境で現在ログインしているユーザー名が使われます。",
  },
  {
    id: "appendix-ex04",
    chapterId: "appendix",
    type: "quiz",
    prompt: "man コマンドと info コマンドの違いとして最も適切なものはどれですか?",
    choices: [
      "manは1ページのマニュアルを表示するのに対し、infoはノード(章・節)をリンクでたどりながら階層的に閲覧できる",
      "manは日本語専用、infoは英語専用のマニュアル表示コマンドである",
      "infoはネットワーク経由でマニュアルをダウンロードするコマンドで、manはローカルのみに対応する",
      "manとinfoはまったく同じ内容を異なるフォントで表示するだけの違いしかない",
    ],
    correctChoiceIndex: 0,
    hints: [
      "GNUプロジェクトのコマンドは、manより詳しい説明がinfoにまとまっていることがあります。",
      "infoはWebページのように「リンク」をたどって別のノードへ移動できる点が特徴です。",
    ],
    explanation:
      "manコマンドが表示するマニュアルページは基本的に1つのページ(トピック)にまとまっているのに対し、" +
      "infoコマンドはドキュメントを「ノード」と呼ばれる単位に分割し、メニューやリンクをたどりながら" +
      "階層的に閲覧できる仕組みを持っています。GNU製コマンド(bash, gcc等)は、manより詳しい説明がinfoに" +
      "用意されていることが多くあります。",
  },
  {
    id: "appendix-ex05",
    chapterId: "appendix",
    type: "quiz",
    prompt: "infoコマンドの操作として正しいものはどれですか?",
    choices: [
      "Spaceキーで次の画面へスクロールし、nキーで次のノード、pキーで前のノードへ移動できる",
      "infoは対話的な操作を一切受け付けず、常に全文を一括表示するだけである",
      "infoではqキーを押すと、そのままシャットダウンが実行される",
      "infoはマウス操作専用で、キーボードからは終了できない",
    ],
    correctChoiceIndex: 0,
    hints: ["manページと同様、Spaceキーでのスクロールに加えて、ノード間を移動するための専用キーがあります。"],
    explanation:
      "infoコマンドの表示中は、Spaceキー/Backspaceキーで画面のスクロール、nキーで次のノード、pキーで前の" +
      "ノード、uキーで一つ上の階層のノードへ移動できます。manと同じくqキーで終了します。",
  },
  {
    id: "appendix-ex06",
    chapterId: "appendix",
    type: "quiz",
    prompt: "Linuxで日本語を入力できるようにするために、一般的に必要となるソフトウェアはどれですか?",
    choices: [
      "IME(Input Method Editor)。ibus-mozcやfcitx-mozcのような「入力メソッド」と呼ばれる仕組み",
      "特別なソフトウェアは不要で、キーボードを日本語配列に交換するだけでよい",
      "SSH。SSH経由で接続すると自動的に日本語入力が有効になる",
      "Vimエディタ。Vimをインストールすると日本語入力もあわせて有効になる",
      "ディスプレイドライバ。GPUのドライバを更新すると日本語入力が有効になる",
    ],
    correctChoiceIndex: 0,
    hints: ["「かな漢字変換」を行うソフトウェアの総称を思い出してみましょう。"],
    explanation:
      "日本語のようにローマ字入力からひらがな・漢字への変換が必要な言語を入力するには、IME" +
      "(Input Method Editor、入力メソッド)と呼ばれるソフトウェアが必要です。Linuxではibusやfcitxといった" +
      "入力メソッドフレームワークに、Mozcなどの日本語変換エンジンを組み合わせて利用するのが一般的です。",
  },
  {
    id: "appendix-ex07",
    chapterId: "appendix",
    type: "quiz",
    prompt: "日本語入力中に「半角英数」と「日本語(ひらがな)入力」を切り替える一般的な操作はどれですか?",
    choices: [
      "半角/全角キー(または Ctrl+Space 等)でIMEのオン/オフを切り替える",
      "Ctrl+Cを押すたびに入力モードが自動的に切り替わる",
      "マウスを右クリックしないと入力モードは切り替えられない",
      "OSを再起動しない限り、一度設定した入力モードは変更できない",
    ],
    correctChoiceIndex: 0,
    hints: ["日本語配列キーボードにある専用キーの名前を思い出してみましょう。"],
    explanation:
      "多くのLinuxディストリビューションでは、半角/全角キー(日本語配列キーボードの場合)や Ctrl+Space" +
      "(englishキーボードでよく割り当てられるショートカット)でIMEのオン/オフを切り替え、日本語入力と" +
      "半角英数入力を素早く切り替えられるようになっています。",
  },
  {
    id: "appendix-ex08",
    chapterId: "appendix",
    prompt: "study@webserver というホスト名の仮想リモートホストへ、sshコマンドで接続してください。",
    referenceSolution: "ssh study@webserver",
    hints: [
      "ssh [ユーザー名@]ホスト名 の形式で接続します。",
      "このアプリでは webserver という名前の仮想リモートホストにのみ接続できます。",
    ],
    explanation:
      "ssh study@webserver を実行すると、webserverという仮想リモートホストへの接続が完了し、以後のコマンドは" +
      "ローカル環境ではなくwebserver上の仮想ファイルシステムに対して実行されるようになります。実際のsshと" +
      "同様に、接続直後は初回接続の警告メッセージが表示されます。",
  },
  {
    id: "appendix-ex09",
    chapterId: "appendix",
    prompt:
      "study@webserver にSSH接続したうえで、接続先ホストのホスト名を /etc/hostname から確認してください" +
      "(1行のコマンドとして ; でつないでください)。",
    referenceSolution: "ssh study@webserver; cat /etc/hostname",
    hints: [
      "ssh study@webserver; の後に続けてコマンドを書くと、接続後のリモートホスト上でそのコマンドが実行されます。",
      "/etc/hostname はホスト名が書かれた設定ファイルです。",
    ],
    explanation:
      "sshで接続すると、以後のコマンドはリモートホスト(webserver)の仮想ファイルシステムに対して実行される" +
      "ため、/etc/hostname を読むとローカル環境とは異なる「webserver」という内容が表示されます。これは" +
      "「ホスト固有のVFSへの切替」が実際に起きていることを確認するための操作です。",
  },
  {
    id: "appendix-ex10",
    chapterId: "appendix",
    prompt:
      "study@webserver にSSH接続したうえで、ホームディレクトリ直下の deploy/README.md の内容を確認して" +
      "ください(1行のコマンドとして ; でつないでください)。このファイルはローカル環境には存在しません。",
    referenceSolution: "ssh study@webserver; cat deploy/README.md",
    hints: [
      "接続直後のカレントディレクトリは、webserver上のホームディレクトリ(/home/study)です。",
      "cat 相対パス で、カレントディレクトリからの相対パスにあるファイルを表示できます。",
    ],
    explanation:
      "deploy/README.md はwebserver専用の仮想ファイルシステムにのみ存在するファイルです。ローカル環境の" +
      "~/practiceにはこのファイルが存在しないため、sshで接続してVFSが切り替わっていることの確認になります。",
  },
  {
    id: "appendix-ex11",
    chapterId: "appendix",
    prompt:
      "study@webserver にSSH接続したうえで、Webサーバーのアクセスログ(/var/log/nginx/access.log)を表示" +
      "してください(1行のコマンドとして ; でつないでください)。",
    referenceSolution: "ssh study@webserver; cat /var/log/nginx/access.log",
    hints: ["絶対パス /var/log/nginx/access.log を指定して cat コマンドで表示します。"],
    explanation:
      "/var/log/nginx/access.log はwebserverの仮想ファイルシステム上に用意された、Webサーバーへの" +
      "アクセスログのサンプルです。実際の運用でも、SSH接続したサーバー上でこうしたログファイルを確認する" +
      "操作はよく行われます。",
  },
  {
    id: "appendix-ex12",
    chapterId: "appendix",
    prompt:
      "study@webserver にSSH接続したあと、exit コマンドでローカル環境に戻り、pwd で元のホームディレクトリ" +
      "に戻っていることを確認してください(1行のコマンドとして ; でつないでください)。",
    referenceSolution: "ssh study@webserver; exit; pwd",
    hints: [
      "実際のsshセッションと同様、exit コマンドでリモートホストからログアウトし、ローカルの状態に復帰します。",
      "ログアウト後は、ssh接続前のカレントディレクトリ・ファイルシステムの状態にそのまま戻ります。",
    ],
    explanation:
      "exit コマンドは、ssh接続中のシェルではリモートホストからログアウトしてローカル環境へ復帰する動作に" +
      "なります(スクリプトの終端で使う「シェル全体を終了する」exitと同じコマンドですが、ssh接続中は" +
      "「ログアウト」として振る舞います)。ログアウト後にpwdを実行すると、接続前のカレントディレクトリ" +
      "(ローカルのホームディレクトリ)が表示され、ファイルシステムもローカルの状態に戻っていることが" +
      "わかります。",
  },
];
