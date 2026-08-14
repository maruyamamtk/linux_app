/** 仮想パッケージリポジトリに登録された1パッケージの固定メタデータ。 */
export interface PackageDefinition {
  name: string;
  version: string;
  /** ダウンロードサイズの目安(KB単位)。`info`/`install`の表示にのみ使用する固定値。 */
  sizeKb: number;
  summary: string;
  /** このパッケージが依存する他パッケージ名(`install`時に自動解決する)。 */
  dependencies: string[];
}
