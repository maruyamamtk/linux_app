# LinuxDojo(仮) — Linuxコマンド演習アプリ

『新しいLinuxの教科書 第2版』の内容をもとに、コマンドラインとシェルスクリプトの書き方をスマホ上のシミュレータで演習形式で学べるアプリ。

## ドキュメント
- [要件定義書](docs/requirements.md)

## ステータス
Expoプロジェクトの雛形を構築済み。VFS・コマンドインタプリタ等の実装はこれから着手する。

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
