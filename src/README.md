# ディレクトリ構成

- `engine/`: シェル構文解析・仮想ファイルシステム(VFS)・コマンドインタプリタ・採点エンジンなど、UIに依存しないロジック層。
- `ui/`: 画面(`screens/`)や再利用可能なコンポーネント(`components/`)などのReact Native UI層。
- `content/`: 章・ユニット・演習の定義データ(JSON/TS)やVFSスナップショットなどの静的コンテンツ。
- `navigation/`: React Navigationによる画面遷移の設定。

詳細は [docs/requirements.md](../docs/requirements.md) を参照。
