import type { MockProcess } from "../engine/commands";
import type { ScriptTestCase } from "../engine/grading";

export type Exercise = {
  id: string;
  chapterId: string;
  prompt: string;
  /**
   * "terminal"(通常のターミナル演習, デフォルト)・"script"(スクリプト作成モード、Ch15-17向け)・
   * "quiz"(選択式クイズ、Ch2-3向け。仮想ターミナルを使わずchoices/correctChoiceIndexで正誤判定する)・
   * "vim"(Vim演習画面、Ch7向け。仮想ターミナルを使わずinitialFileText/expectedFileTextで正誤判定する)。
   */
  type?: "terminal" | "script" | "quiz" | "vim";
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
];
