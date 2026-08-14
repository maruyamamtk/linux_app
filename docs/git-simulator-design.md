# Gitシミュレータ 技術検証・設計メモ

Issue #53 対応。`docs/requirements.md` 3章5節(画面構成)・9章リスク項目3 に関する設計結果をまとめる。
本ドキュメントは実装(コーディング)には着手せず、着手前の詳細設計のみを行う(9章「Vim/Gitシミュレータの
実装コスト」で個別の詳細設計を挟むことが推奨されているため。Vim側の先行設計は
`docs/vim-simulator-design.md` を参照)。

## 1. 前提・スコープの確認

- 対象は書籍Ch19「Git」。要件定義書2章のPhase2表では「git add/commit/branch/merge/push/pull」が
  演習内容として、実現方式は「専用のGitオブジェクトモデル・シミュレータ(ワークツリー/インデックス/
  リポジトリ/擬似リモート)」と挙げられている。
- 要件定義書8章(スコープ外)により、実際のネットワーク通信を伴う`push`/`pull`の完全再現は対象外。
  あくまで概念(ローカルに置いた「もう1つのリポジトリ」との間でオブジェクトをやり取りする)の
  シミュレートに留める。
- Vimシミュレータ(`src/engine/vim/`)とは異なり、Gitコマンドは専用のモーダルUIを必要とせず、
  既存の仮想ターミナル(`src/ui/components/Terminal.tsx` + `src/engine/interpreter` +
  `src/engine/commands`)にコマンドの1つとして自然に組み込める(`git add`, `git commit -m "..."`
  のように、他のcoreutils風コマンドと同じ「コマンド名 + 引数」の形で入力される)。したがって
  Gitは**独立したモード遷移状態機械(Vimのような`applyKey`)ではなく、既存の`CommandHandler`
  (`src/engine/commands/types.ts`)として実装する**方針とする。
- 一方で要件定義書5章の画面構成には「Git演習画面(Phase2): コミットグラフの可視化+コマンド入力」が
  別途挙げられている。これは「ターミナル入力」自体は既存基盤を再利用しつつ、その脇にコミットグラフを
  描画する専用パネルを追加する画面、という位置付けになる(10章で詳細)。

## 2. 全体アーキテクチャ方針: リポジトリ状態をVFS上の実データとして表現する

最初に決めるべき設計上の分岐点は、「Gitのリポジトリ状態(オブジェクト・インデックス・ブランチ)を
`CommandContext`に新しいフィールドとして追加する(Vimの`VimState`や`MockProcess[]`と同様の
専用ステート)か、それとも既存の仮想ファイルシステム(VFS)上の`.git/`ディレクトリとして
表現するか」である。本設計では**後者(VFS上の実データとして表現する)を採用する**。

**採用理由:**
- 実際のGitも`.git/objects`・`.git/refs`・`.git/index`・`.git/HEAD`をリポジトリのワークツリー内に
  ファイルとして保持しており、教科書(Ch19)の解説とも整合する。学習者が`ls -a`や`cat .git/HEAD`で
  中身を覗く演習も自然に作れる。
- 採点エンジン(`src/engine/grading`)は「実行後のVFS状態(ファイルの有無・内容・パーミッション)」を
  模範解答実行後の状態と突き合わせる`compareVfs`の仕組みを既に持つ(`GradeOptions.compareVfs`,
  `diffTree`)。リポジトリ状態をVFS上のファイルとして表現すれば、**この既存の仕組みをそのまま
  流用でき**、`CommandContext`・`GradeInput`・`VirtualFileSystem`本体に変更を加える必要がない
  (Vimが独自の`VimState`比較ロジックを新設したのとは対照的に、Gitは既存基盤への追加コストが
  ほぼゼロで済む)。
- 「擬似リモート」も、単に別のVFSパス(例: `.git`はあるが作業ツリーを持たない「bareリポジトリ」
  ディレクトリ)として表現できるため、リモート用に別種の状態構造を新設する必要がない(3.6節)。

この方針の代償として、Gitオブジェクト(blob/tree/commit)はVFS上では「内容を表すJSON文字列を持つ
通常のファイル」として表現される(実Gitのzlib圧縮バイナリ形式ではない)。これは`tar`/`zip`が
実バイト圧縮を行わず構造化JSONで代替している`src/engine/commands/archive.ts`と同じ簡略化方針であり、
本アプリの一貫した設計判断である(5章・8章で詳述)。

## 3. データモデル設計

### 3.1 Gitオブジェクト(blob / tree / commit)

実Gitのオブジェクトモデルをほぼそのまま踏襲する。3種のオブジェクトをJSONとして表現する。

```ts
export interface GitBlobObject {
  type: "blob";
  /** ファイル内容そのもの。 */
  content: string;
}

export interface GitTreeEntry {
  name: string;
  mode: "100644" | "100755" | "040000"; // 通常ファイル / 実行可能ファイル / ディレクトリ(実Gitのモード文字列を踏襲)
  type: "blob" | "tree";
  hash: string;
}

export interface GitTreeObject {
  type: "tree";
  entries: GitTreeEntry[]; // name昇順にソートして保持(ハッシュの決定性のため。3.2節)
}

export interface GitCommitObject {
  type: "commit";
  tree: string; // GitTreeObjectのハッシュ
  parents: string[]; // 通常のcommitは1つ、mergeコミットは2つ、initial commitは0個
  author: string; // "study <study@localhost>" 形式(3.4節)
  message: string;
  /** 実時刻ではなく決定的な論理時刻。8章参照。 */
  sequence: number;
}

export type GitObject = GitBlobObject | GitTreeObject | GitCommitObject;
```

- `tree`はディレクトリ1階層分を表し、サブディレクトリは別の`tree`オブジェクトへの参照になる
  (実Gitと同じ再帰構造)。
- `commit`は`author`と`committer`を区別せず1フィールドにまとめる(本シミュレータでは
  `git commit --amend`等で両者が乖離するケースを扱わないため簡略化する。4.6節)。

### 3.2 オブジェクトハッシュの実装方針

実Gitはblob/tree/commitの内容からSHA-1(新しいGitではSHA-256移行も進むが教科書はSHA-1世代)を
計算するが、本シミュレータでは**暗号学的ハッシュ関数を実装・依存しない**。理由は以下の2点:

1. React Native(Hermes)環境でNode.jsの`crypto`モジュールは使えず、暗号ライブラリの追加は
   要件定義書9章リスク項目1(パーサ選定)と同種の「サードパーティ依存がHermesで動くか」という
   新たな検証コストを生む。
2. 本シミュレータの用途は「同じ内容から同じハッシュが決定的に得られること」(=学習者と模範解答の
   実行結果を比較できること)であり、衝突耐性等の暗号学的安全性は不要。

そこで、オブジェクトの正規化JSON文字列(キー順を固定した`JSON.stringify`)に対して、
FNV-1a(32bit)のような軽量な非暗号ハッシュを2〜3回チェイン適用し16進数40桁相当の文字列に
仕上げる、依存ライブラリ不要な自前関数(`hashObject(object: GitObject): string`)を
`src/engine/git/hash.ts`に実装する。実Gitと同じ40桁16進文字列の見た目にすることで、
`git log`の`commit <hash>`表示や`git branch -v`の短縮ハッシュ表示を教科書の見た目に近づける
(値そのものが実Gitと一致する必要はない)。

- `tree`オブジェクトの`entries`は必ず`name`昇順にソートしてからハッシュ計算する。同じ内容の
  ディレクトリが常に同じハッシュになることを保証するため(実Gitも同様にソートして格納する)。
- `commit`オブジェクトのハッシュには`sequence`(8章)を含めるが、実時刻は含めない
  (実時刻を含めると学習者と模範解答で必ずハッシュが食い違ってしまうため。8章で詳述)。

### 3.3 リポジトリのVFS上のレイアウト

演習の初期VFSスナップショット(例: `/home/study/practice/ch19_git/`)に、`git init`実行後
(または初期状態として最初から)以下のファイル群を持たせる。すべて`context.vfs`の通常の
`readFile`/`writeFile`/`mkdir`で読み書きする(VFS側にGit専用APIは追加しない)。

```
<repo>/
├── .git/
│   ├── HEAD                  # "ref: refs/heads/main\n" (ブランチ上) または裸のハッシュ(detached HEAD、4.6節でスコープ外)
│   ├── config                # JSON1行。{ "remotes": { "origin": "<VFS絶対パス>" } } (3.6節)
│   ├── index                 # JSON1行。GitIndexEntry[] (3.4節)
│   ├── refs/
│   │   ├── heads/
│   │   │   ├── main          # コミットハッシュの文字列
│   │   │   └── <branch>      # 同上
│   │   └── remotes/
│   │       └── origin/
│   │           └── main      # 直近のfetch/pull/push時点のリモート追跡ブランチ(3.6節)
│   └── objects/
│       └── <hash>            # GitObjectのJSON文字列を1ファイル1オブジェクトとして格納
└── (ワークツリーの実ファイル。cat/lsで見えるものと同じ)
```

- 実Gitの`.git/objects/xx/yyyy...`のような2階層シャーディングは行わず、`.git/objects/<hash>`の
  フラットな1階層に格納する(教科書の演習規模ではオブジェクト数がシャーディングを要するほど
  多くならないため、単純さを優先)。
- `.git`配下は`root`所有ではなく通常のユーザー(`study`)所有・書き込み可能とする(実Gitと同様、
  リポジトリ所有者が自由に操作できる必要があるため)。

### 3.4 インデックス(ステージングエリア)

```ts
export interface GitIndexEntry {
  /** リポジトリルートからの相対パス。例: "practice/memo.txt" */
  path: string;
  mode: "100644" | "100755";
  /** ステージ時点のファイル内容から計算したblobハッシュ。 */
  blobHash: string;
}

export type GitIndex = GitIndexEntry[];
```

- `git add <path>`は対象ファイルの現在のワークツリー内容から`blob`オブジェクトを作成・
  `.git/objects/`へ書き込み、`.git/index`の該当エントリを追加/更新する(既存エントリがあれば
  `blobHash`を上書き)。
- `git commit`は`.git/index`の内容から`tree`オブジェクト群(ディレクトリ階層ぶん)を組み立てて
  新規`commit`オブジェクトを作成する。実Gitと異なり、コミット後もインデックスの内容はクリアしない
  (実Gitもコミット後のインデックスは直前のコミットのtreeと一致した状態を保つ、という実際の挙動を
  素直に踏襲する)。

### 3.5 ワークツリー

ワークツリーは特別な表現を持たない。単に`<repo>/`配下(`.git/`を除く)の通常のVFSファイル・
ディレクトリそのものである。`cat`/`ls`/`vim`演習等、既存の全コマンドがそのまま作用する。

- `git status`は「ワークツリーの現在の内容」「`.git/index`の内容」「HEADが指すコミットのtree」の
  3者を比較し、`Changes not staged for commit`(ワークツリー ≠ インデックス)・
  `Changes to be committed`(インデックス ≠ HEAD tree)・`Untracked files`(indexにもHEAD treeにも
  無いファイル)を分類して表示する(実Gitの3方比較をそのまま踏襲。教科書のGit解説で必ず登場する
  概念であるため)。

### 3.6 擬似リモート

「擬似リモート」は、**同じVFS内の別パスに置かれた、ワークツリーを持たない(`.git/`のみの)
ディレクトリ**として表現する。演習の初期スナップショットが、例えば
`/home/study/practice/ch19_git/remote/`のような「教員役のGitHub相当」ディレクトリを
あらかじめ用意しておき、ローカルリポジトリの`.git/config`の`remotes.origin`に
そのVFS絶対パスを設定した状態(=「既にclone済みでoriginが設定されている」状態)を初期状態とする。

- **`git clone`は本シミュレータでは実装しない**(4章)。実行環境をまたぐ「新規ディレクトリへの
  複製」という操作は、初期スナップショットの設計(演習ごとに「クローン済みのローカルリポジトリ」を
  シードデータとして用意する)で代替できるため、実装コストに見合わない。
- `git push origin <branch>`: ローカルの`refs/heads/<branch>`が指すコミットから到達可能な
  オブジェクト(commit/tree/blob)のうち、リモート側の`.git/objects/`にまだ無いものをコピーし、
  リモート側の`refs/heads/<branch>`を更新する。ローカルの`refs/heads/<branch>`がリモートの
  現在のコミットの祖先でない場合(fast-forwardでない場合)は実Gitと同様`push`を拒否する
  (`! [rejected]`, non-fast-forward)。`--force`はスコープ外(4章)。
- `git pull origin <branch>`は`git fetch`(リモートの`refs/heads/<branch>`から到達可能な
  未取得オブジェクトをローカルにコピーし、`refs/remotes/origin/<branch>`を更新する)+
  `git merge refs/remotes/origin/<branch>`の合成として実装する(4.5節のmergeロジックを再利用)。
- ネットワーク遅延・認証・失敗(接続不可)等は一切シミュレートしない。VFS内のファイルコピーとして
  即時に完了する操作である(要件定義書8章のスコープ外方針と整合)。

## 4. CommandContextとの統合方針

2章の方針により、`src/engine/commands/types.ts`の`CommandContext`(`vfs`, `cwd`, `env`,
`processes`, `stdin`)に**変更は不要**である。Gitコマンドの実装(`src/engine/commands/git.ts`、
5章)は他のコマンドと同じく`context.vfs`を通じて`.git/`配下のファイルを読み書きするだけで完結する。

コミットの著者情報(`author`フィールド)は、`su`/`sudo`が使う`context.vfs.getUser()`
(`VfsUser { name, groups, isRoot? }`、`src/engine/vfs/virtualFileSystem.ts`)から
`"<name> <<name>@localhost>"`の形式で自動的に組み立てる。実Gitのように`git config user.name`/
`user.email`を個別設定させる演習は要件定義書2章の演習内容(add/commit/branch/merge/push/pull)に
含まれないため、**`git config`によるユーザー設定はスコープ外とし、VFSの現在ユーザーから自動導出する**
(教科書のCh9で学んだ`su`/`sudo`の概念とGitのauthor情報を結び付けられる副次効果もある)。

## 5. 対応するコマンド範囲

要件定義書2章Phase2表に挙がっている「add/commit/branch/merge/push/pull」を中核スコープとし、
これらを使うために最低限必要な補助コマンド(init/status/log/checkout)を加える。

### 5.1 `git init`

`.git/`ディレクトリと3.3節のレイアウト(空の`objects/`・`refs/heads/`、`HEAD`は
`"ref: refs/heads/main\n"`、空の`index`)を作成する。演習の初期スナップショットは基本的に
「`git init`済み」の状態から始める想定だが、コマンド自体も対応スコープに含め、
「まっさらなディレクトリでリポジトリを作り始める」演習も作れるようにする。

### 5.2 `git status`

3.5節参照。`On branch <name>`、ステージ済み/未ステージ/未追跡ファイルの一覧を実Git風の文言で表示する。

### 5.3 `git add <path>...`

3.4節参照。複数パス指定、ディレクトリ指定時の再帰追加に対応する。`git add .`(カレントディレクトリ
以下すべて)は必須頻出パターンのため対応する。

### 5.4 `git commit -m "<message>"`

`.git/index`から3.4節の手順でtree群を構築し、新規commitオブジェクトを作成、現在のブランチの
`refs/heads/<branch>`を新しいコミットハッシュに更新する。`-m`オプション必須(エディタを開く
無引数`git commit`はモバイルUIとの相性が悪いためスコープ外、4章)。

### 5.5 `git log`

HEADから`parents`をたどってコミット履歴を表示する(`--oneline`のみ簡易対応、フルフォーマットは
`commit <hash>` / `Author: <author>` / `Date: <sequenceから合成した固定フォーマットの日時文字列>` /
インデント2文字の`<message>`という教科書準拠のブロック形式)。

### 5.6 `git branch [<name>]`

引数無しは既存ブランチ一覧(現在のブランチに`*`を付与)、引数ありは現在のHEADコミットを指す
新規ブランチ(`refs/heads/<name>`)を作成する。`-d`(削除)は演習頻度が低いため4章でスコープ外とする。

### 5.7 `git checkout <branch>` / `git switch <branch>`

`refs/heads/<branch>`が指すコミットのtreeをワークツリーへ再展開(materialize)し、`HEAD`を
`"ref: refs/heads/<branch>\n"`に書き換える。tree再展開は、対象コミットのtreeに存在しないが
現在のワークツリーに存在するファイルを削除し、tree側の内容でファイルを上書き/新規作成する
再帰処理として実装する(`src/engine/git/checkout.ts`)。`-b`(ブランチ作成+切り替えの糖衣)にも対応する。
未コミットの変更がある状態でのcheckout(実Gitでは競合の可能性に応じて拒否/自動マージされる)は
複雑さに対して学習効果が薄いため、**未コミットの変更(ワークツリー≠index、またはindex≠HEAD tree)が
ある場合は実Gitに倣いエラーで拒否する**、という単純なルールに留める(4章)。

### 5.8 `git merge <branch>`

7章で詳述。fast-forwardと、非衝突なケースに限った簡易3-wayマージのみサポートする。

### 5.9 `git remote add origin <path>` / `git remote -v`

`.git/config`の`remotes.origin`を設定/表示する。`<path>`はVFS上の絶対パス(3.6節)。

### 5.10 `git push origin <branch>` / `git pull origin <branch>`

3.6節参照。

## 6. スコープ外(意図的に未対応)

書籍Ch19・要件定義書2章の演習内容(add/commit/branch/merge/push/pull)を超える範囲は、
実装コストに対して学習効果が薄いため今回は対象外とする。Vim設計(`docs/vim-simulator-design.md`
5章)と同様、未対応のサブコマンド・オプションが入力された場合はサイレントに無視せず、
`git: '<subcommand>' is not a supported command in this simulator`のようなエラー
(終了ステータス非0)をstderrへ返し、ユーザーにフィードバックする。

- **`git clone`**: 3.6節の理由により、初期スナップショットの設計で代替する。
- **`git config`によるuser.name/user.email個別設定**: 4章の理由によりVFSユーザーから自動導出する。
- **コンフリクトマーカーの挿入・手動解消フロー**(`git merge`が衝突した際に`<<<<<<<`/`=======`/
  `>>>>>>>`をファイルに書き込み、`git add`+`git commit`で手動解決する一連の流れ): 7章参照。
  実装・UI双方のコストが大きいため見送り、衝突が起きる演習シナリオ自体を作らない方針とする。
- **`git rebase`(通常/`-i`)・`git cherry-pick`・`git revert`**: コミット履歴の書き換え系操作は
  概念的にも実装的にも複雑度が高く、教科書の基本演習(add/commit/branch/merge/push/pull)には
  含まれないため対象外。
- **`git stash`**: 一時退避という概念自体は有用だが、演習内容表に含まれないため見送り。
- **`git tag`**: 対象外。
- **`git reset`(`--soft`/`--mixed`/`--hard`)・`git revert`**: 対象外。誤操作からの復旧手順は
  範囲外とする。
- **`git diff`**: `sed`/`diff`コマンド(`src/engine/commands/textProc.ts`の`diffCommand`)との
  機能重複があり実装自体は難しくないが、要件定義書2章の演習内容表に明記が無いため、初回スコープでは
  見送り、必要になった時点で別Issueで追加を検討する。
- **`git blame`・`git reflog`・`git bisect`**: 対象外。
- **`.gitignore`**: 対象外(`git status`は常に全ファイルを走査する単純な実装とする)。
- **サブモジュール・複数リモート・複数worktree**: 対象外。リモートは`origin`1つのみ対応する。
- **detached HEAD状態**(`git checkout <commit-hash>`でブランチではなくコミットに直接チェックアウト):
  対象外。`git checkout`/`git switch`の引数は常にブランチ名として扱う。
- **`--force`系オプション全般**(`push --force`, `checkout --force`等): 対象外(6章5.7節・5.10節参照)。

## 7. マージ・コンフリクトの扱い

`git merge <branch>`は以下の優先順で判定する。

1. **既にマージ済み**: `<branch>`のコミットが現在のHEADの祖先である場合、
   `Already up to date.`を出力し何もしない。
2. **fast-forward**: 現在のHEADコミットが`<branch>`のコミットの祖先である場合、現在のブランチの
   refを`<branch>`のコミットハッシュへ直接更新し、ワークツリーを5.7節の再展開処理で更新する
   (新規マージコミットは作らない、実Gitのデフォルト挙動と同じ)。
3. **非衝突な3-wayマージ**: 上記いずれでもない(履歴が分岐している)場合、共通祖先コミット
   (`findMergeBase`: 双方の祖先コミット集合の共通部分のうち最も新しいもの)のtreeを基準に、
   「現在のHEAD」と「`<branch>`」それぞれのtreeとをファイル単位で比較する。
   - 片方のみで変更されたファイル → その変更を採用
   - 両方で同一内容に変更されたファイル → その内容を採用
   - **両方で異なる内容に変更された同一ファイル → 衝突とみなし、`git merge`全体を失敗させる**
     (`CONFLICT (content): Merge conflict in <path>`をstderrへ出力、終了ステータス1。
     ワークツリー・index・refはマージ試行前の状態のまま変更しない = 実Gitの「マージ失敗時は
     `MERGE_HEAD`等が残り手動解決が必要」という状態を単純化し、「そもそもマージが成立しなかった」
     ことにして片付ける)
   - 衝突が無ければ、親を2つ(現在のHEAD, `<branch>`)持つ新規マージコミットを作成し、
     ブランチrefを更新、ワークツリーを再展開する。

**設計判断の理由**: 6章の通り、コンフリクトマーカーを使った手動解消フローの実装・UI双方のコストは
Vimシミュレータの検索機能省略(`docs/vim-simulator-design.md` 5章)以上に大きく、
「ファイル単位で同時変更が無い(=衝突しない)ように演習の初期データを設計する」という運用でカバーする
方が費用対効果が高いと判断した。教科書のCh19演習も基本的なブランチ運用(機能ブランチを切って
`main`にマージする、等)を扱う想定であり、意図的に衝突を発生させる高度な演習は想定していない。

## 8. 決定性(ハッシュ・タイムスタンプ)と採点への影響

既存の採点エンジン(`src/engine/grading`)は、学習者の入力と模範解答を**同一の初期スナップショードに
対してそれぞれ独立に実行し**、結果(stdout/stderr/終了ステータス/VFS状態)を突き合わせる方式を採る
(`docs/vim-simulator-design.md` 6章でVim演習にも同じ方針を適用済み)。この方式がGitでも成立するには、
「学習者の操作列」と「模範解答の操作列」が**同じ観測可能な効果に到達するなら、実行タイミングに
関わらず同一のVFS状態(同一の`.git/objects`のファイル名・内容、同一の`refs/*`の内容)になる**
ことが必要になる。

これを妨げる最大の要因は**コミットの実時刻**である。学習者と模範解答は別々のタイミング(場合によっては
別々の実行環境)でコミットを作成するため、コミットオブジェクトに実時刻(`Date.now()`)を含めると、
同じ操作をしても`commit`オブジェクトの内容(延いてはハッシュ)が一致せず、`compareVfs`が誤って
不一致と判定してしまう。

**対応方針**: コミットオブジェクトの`sequence`(3.1節)は実時刻を使わず、**そのリポジトリ内で
何番目のコミットか(0始まりの連番)を、到達可能なコミット数から決定的に算出する**
(具体的には「親コミットの`sequence`の最大値+1」。initial commitは0)。`git log`表示用の日時文字列も、
固定の起点日時(例: `2024-01-01T00:00:00+09:00`)に`sequence * 1日`を加算して合成した文字列とし、
実時刻・乱数は一切使用しない。これにより「学習者が模範解答と同じコマンド列を実行すれば、
実行タイミングに関わらず`.git/objects`配下のファイル名(ハッシュ)・内容が完全に一致する」ことが
保証され、既存の`compareVfs`ベースの採点方式をそのまま適用できる。

なお、この設計は「実際のGitのコミット日時は操作した時刻を正確に反映する」という現実の挙動とは
異なる(教育上の簡略化)。演習の解説文で「本シミュレータでは日時が実際の操作時刻ではなく決定的な
連番から生成されている」旨を必要に応じて注記する。

## 9. 採点(グレーディング)方針への反映

2章・8章の設計により、**Git演習は既存の`GradeInput`/`GradeOptions`(`src/engine/grading/types.ts`)に
変更を加えず、通常の`type: "terminal"`または`type: "script"`演習と同じ`compareVfs`ベースの採点で
成立する**(Vim演習が`type: "vim"`という専用タイプと専用比較ロジックを必要としたのとは対照的)。

- `referenceSolution`には模範解答のGitコマンド列(複数行、例: `"git add memo.txt\ngit commit -m
  \"Add memo\"\n"`)をそのまま設定する。
- `compareVfs: true`(デフォルト)により、`.git/objects`・`.git/refs`・`.git/index`を含む
  リポジトリ全体の状態が、模範解答実行後の状態と一致するかを検証する。8章の決定性設計により、
  「同じ意味のコミットを別の順序のコマンドで作る」ような別解(例: `git add a.txt b.txt`と
  `git add a.txt; git add b.txt`の2手順)は最終的な`.git/index`の内容さえ一致すれば正解として
  扱える。一方で「別のコミットメッセージで同じ変更をコミットする」ようなケースは、コミットの内容
  (`message`フィールド)がハッシュに含まれるため`.git/objects`の内容が変わり不正解となる
  (メッセージ文言も含めて模範解答と一致させる演習、という設計として意図的にこの挙動を採用する)。
- `git log`/`git status`の標準出力を突き合わせたい演習では、通常の`stdoutMode`
  (デフォルト`"trimTrailingNewline"`)がそのまま使える。8章の決定的な日時生成により、
  `git log`の出力も学習者・模範解答間で完全一致する。

## 10. 画面構成への反映

要件定義書3章5節の「Git演習画面(Phase2): コミットグラフの可視化+コマンド入力」は、以下のように
本設計へ対応させる:

- 「コマンド入力」部分 → 既存の`Terminal.tsx`をそのまま再利用する(2章の通りGitコマンドは
  通常のコマンドとして`executeCommand`に流れるため、Vim演習画面のような専用入力UIを新設する
  必要がない)。
- 「コミットグラフの可視化」部分 → 現在のリポジトリの全ブランチref(`refs/heads/*`)から到達可能な
  コミットを`parents`でたどって収集し、コミットをノード・親子関係をエッジとするグラフを構築する
  読み取り専用の変換関数(`buildCommitGraph(vfs, repoPath): CommitGraph`)を`src/engine/git/`に
  用意し、UI側(`src/ui/components/CommitGraphView.tsx`相当、画面実装フェーズで新設)がそれを
  描画する。この変換関数はコマンド実行のたびに(または一定間隔で)呼び出す想定で、Git状態と
  グラフ表示が食い違わないよう「表示のたびにVFSから再構築する」単純な方式とし、専用の
  差分更新ロジックは持たない(演習1回あたりのコミット数は多くても十数個程度であり、
  毎回全再構築してもパフォーマンス上の問題にならない)。
- グラフの具体的なレイアウトアルゴリズム(ノードの座標計算、ブランチの色分け等)は画面実装フェーズで
  別途詰める(本ドキュメントはデータモデルとコマンド範囲の設計が主眼のため、Vim設計の
  「専用キーパッドUIの詳細は実装フェーズで」という扱いに倣う)。

## 11. 実装ディレクトリ構成(案)

`src/engine/vim/`と同様、React Native/Expoに依存しない純粋なTypeScriptモジュールとして実装する想定。
ただしGitコマンド自体は独自のステート機械を持たず、他のコマンドと同じく`CommandHandler`として
`src/engine/commands/`に置く(2章)。`src/engine/git/`はGit固有のドメインロジック
(オブジェクトモデル・ハッシュ計算・ツリー操作・マージ判定・グラフ構築)を提供し、
`src/engine/commands/git.ts`がそれを呼び出して`CommandResult`に変換する薄いアダプタとなる。

```
src/engine/git/
├── types.ts          # GitObject(Blob/Tree/Commit)/GitIndexEntry/GitConfig 等
├── hash.ts            # hashObject(object): string (3.2節の非暗号ハッシュ)
├── objectStore.ts      # readObject/writeObject(vfs, repoPath, hash) — .git/objects の読み書き
├── refs.ts            # readHead/writeHead/resolveRef/listBranches — .git/HEAD, refs/* の読み書き
├── index.ts(仮称: indexFile.ts) # readIndex/writeIndex — .git/index の読み書き(バレルエクスポートの index.ts と名前が衝突するため実装時に改名を検討)
├── tree.ts            # buildTreeFromIndex/materializeTree(checkout用)
├── commit.ts           # createCommit, findMergeBase, isAncestor
├── merge.ts            # planMerge(fast-forward判定・3-wayマージ・衝突検出、7章)
├── graph.ts            # buildCommitGraph(10章)
├── errors.ts           # GitUnsupportedCommandError 等
└── *.test.ts            # 各モジュール対応のユニットテスト

src/engine/commands/
└── git.ts             # gitCommand: CommandHandler。サブコマンドごとに src/engine/git/* を呼び出す
                          # (registry.ts への "git": gitCommand 登録は実装Issueで行う)
```

## 12. 未確定事項・今後の検証

- **`git diff`・`.gitignore`等、初回スコープ外とした機能の要否**: 実際に演習コンテンツ
  (`src/content/exercises.ts`)を書き始めた際、書籍の解説フローとして`git diff`が無いと
  説明しづらい箇所が出てくる可能性がある。その場合は別Issueで追加検討する(6章)。
- **コミットグラフ可視化コンポーネントの具体的なレイアウト**: 10章の通り、実装フェーズで
  プロトタイピングしながら決める。
- **`Exercise`型・採点エンジンへのGit演習追加の詳細**: 9章の通りGit演習は既存の`type: "terminal"`
  (または`type: "script"`)の枠組みで表現できる見込みだが、`initialCwd`をリポジトリのルートに
  固定する・初期VFSスナップショットに`.git/`一式と擬似リモートを含める、といった演習データの
  具体的な作り方は`src/content/exercises.ts`にCh19の演習を追加する実装Issueで詳細化する。
- **大量演習データでのオブジェクトストアの肥大化**: 演習ごとにVFSスナップショットを独立して
  読み込む既存方式(要件定義書6章)を踏襲する限り、1演習あたりのコミット数は少数(多くても
  十数個)に収まる想定であり、性能上の懸念は低いと考えているが、実装Issueでの実測は別途行う。
