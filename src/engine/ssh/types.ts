import type { VfsSnapshot } from "../vfs";

/** `ssh`コマンドの接続先として登録されている、固定の仮想リモートホスト1台分の定義。 */
export interface RemoteHostDefinition {
  /** `ssh [user@]host` の "host" 部分として指定する名前。 */
  host: string;
  /** プロンプトの `@` の後に表示するホスト名(通常は`host`と同じ)。 */
  promptHost: string;
  /** 接続直後に表示する固定のバナー文字列(末尾改行込み)。 */
  banner: string;
  /** このホストへ接続した際に読み込む、ホスト固有の仮想ファイルシステムの初期スナップショット。 */
  snapshot: VfsSnapshot;
  /** 接続直後のカレントディレクトリ(ホームディレクトリ)。 */
  homeDir: string;
}
