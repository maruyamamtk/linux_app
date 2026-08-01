# LinuxDojo(仮) — Linuxコマンド演習アプリ

『新しいLinuxの教科書 第2版』の内容をもとに、コマンドラインとシェルスクリプトの書き方をスマホ上のシミュレータで演習形式で学べるアプリ。

## ドキュメント
- [要件定義書](docs/requirements.md)

## ステータス
Expoプロジェクトの雛形を構築済み(#1)。VFS・コマンドインタプリタ等のエンジン実装はこれから着手する。

## セットアップ

```sh
npm install
npm start
```

## ディレクトリ構成

詳細は [src/README.md](src/README.md) を参照。

- `src/engine/`: シェル構文解析・VFS・コマンドインタプリタ・採点エンジン
- `src/ui/`: 画面(`screens/`)・コンポーネント(`components/`)
- `src/content/`: 章・演習の定義データ
- `src/navigation/`: 画面遷移(React Navigation)

## Lint / Format

```sh
npm run lint
npm run format
```
