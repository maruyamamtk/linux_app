# LinuxDojo(仮) — Linuxコマンド演習アプリ

『新しいLinuxの教科書 第2版』の内容をもとに、コマンドラインとシェルスクリプトの書き方をスマホ上のシミュレータで演習形式で学べるアプリ。

## ドキュメント
- [要件定義書](docs/requirements.md)
- [ローカル開発環境での起動方法](docs/local-development.md)

## ステータス
Phase1(MVP、Ch2-3・Ch4-6・Ch8-17)の中核機能を実装済み:
- シェル構文解析(lexer/parser)・インタプリタ(制御構造/関数/IFS/xargs/ヒアドキュメント)・正規表現エンジン(BRE/ERE)
- 組み込みコマンド一式(ファイル操作/検索/権限/プロセス/テキスト処理/grep/sed/awk)・仮想ファイルシステム(VFS)
- 採点エンジン、仮想ターミナルUI、スクリプト作成モードUI
- コンテンツナビゲーションUI(ホーム・ユニット詳細)、進捗管理(要復習リスト・マイページ)、ヒント→模範解答/解説表示
- Phase1全7章分の演習コンテンツ

Phase2(Ch1・Ch7 Vim・Ch18 アーカイブ・Ch19 Git・Ch20 パッケージ管理・付録)は未着手。詳細は[要件定義書](docs/requirements.md)を参照。

## セットアップ

```sh
npm install
npm run lint
npm run typecheck
npm start
```

## ディレクトリ構成

- `src/engine` — コマンドインタプリタ・仮想ファイルシステム・採点エンジン
- `src/ui` — 画面(screens)・コンポーネント
- `src/content` — 章・演習・VFSシードデータ
- `src/navigation` — 画面遷移(React Navigation)

詳細は [src/README.md](src/README.md) を参照。
