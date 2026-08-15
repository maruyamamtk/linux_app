# ローカル開発環境での起動方法

このアプリ(Expo/React Native製)をローカルPCで起動し、動作確認する手順。

## 前提

- Node.js(`package.json` の `expo` SDK 51系に対応するバージョン。20系で動作確認済み)
- npm

## セットアップ

```sh
npm install
```

## 起動方法

起動方法は実行先によって3通りある。いずれも `npm start` 系のコマンドでMetro(バンドラ)が立ち上がる。

### 1. 実機(Expo Go) — 最も手軽

```sh
npm start
```

ターミナルにQRコードが表示されるので、スマホに [Expo Go](https://expo.dev/go) アプリを入れて読み取ると実機で起動する。PCとスマホが同一ネットワーク上にある必要がある。

QRコード読み取り後にExpo Go側で `Unknown error: The request timed out.` と表示される場合は、スマホがPCのLAN上のMetroサーバーに到達できていない(ネットワークの問題であり、アプリのコード起因ではない)。以下を順に確認する。

1. **PCとスマホが同じWi-Fiネットワークに接続されているか**。ゲストWi-Fi・法人/カフェ等のネットワークは端末間通信(クライアント分離)がブロックされていることが多く、同じSSIDでも繋がらない場合がある。
2. **(macOS)ローカルネットワークの権限**: 「システム設定 → プライバシーとセキュリティ → ローカルネットワーク」で、ターミナル(Claude Codeを実行しているアプリ)へのアクセスが許可されているか確認する。ここが無効だと、ファイアウォールがオフでもスマホからの接続だけが到達しない。
3. **上記で解決しない/ルーター設定を変更できない場合は`--tunnel`を使う**: LANを使わず、どこからでも接続できるモードに切り替える。

   ```sh
   npm run tunnel
   ```

   LAN方式より起動・反映が多少遅いが、ネットワーク構成(Wi-Fi分離・ローカルネットワーク権限)に左右されず確実につながる。

   内部的にはCloudflare Tunnel([`expo-cloudflared`](https://github.com/stacknide/expo-cloudflared)、`package.json`の`overrides`で`@expo/ngrok`をこれに差し替え済み)を使っている。標準の`expo start --tunnel`が内部で使うExpo社の共有ngrokサービスは、悪用によるトラフィック制限で現在不安定なため([expo/expo#43335](https://github.com/expo/expo/issues/43335))、より安定したCloudflareのトンネルに切り替えている。初回実行時に`cloudflared`バイナリ(~40MB)を`~/.expo/expo-cloudflared/`に自動ダウンロードする。

### 2. iOS / Androidシミュレータ

```sh
npm run ios      # Xcode + iOSシミュレータが必要
npm run android   # Android Studio + AVD(エミュレータ)が必要
```

シミュレータ/エミュレータが未セットアップの環境ではこれらは使えない。その場合は方法1か3を使う。

### 3. Webブラウザ — シミュレータ未セットアップな環境では最有力

```sh
npm run web
```

`react-native-web` / `react-dom` / `@expo/metro-runtime` は `package.json` の依存関係に含まれているため、`npm install` 済みであれば追加作業なしでそのまま起動する。

起動すると `http://localhost:8081` でアクセスできる(初回バンドル生成に30秒前後かかることがある)。

## アプリの使い方(画面の流れ)

1. **章一覧(ホーム画面)** — Phase1/Phase2の全章がカード一覧表示される。各カードに完了率が出る。右上の「マイページ」から進捗・要復習リストを確認できる。
2. カードをタップ → **ユニット詳細画面** — その章に含まれる演習(演習1, 演習2, …)の一覧と概要説明が表示される。
3. 演習をタップ → **演習画面** — 上部に問題文、下部に仮想ターミナル(ダーク背景・緑プロンプト)が表示される。
   - ターミナル下部の入力欄にコマンドを入力してEnterで実行(仮想ファイルシステム上でシミュレートされる)。
   - **ヒントを見る** — 段階的なヒントを表示(使用回数の上限あり)。
   - **答え合わせ** — 実行したコマンド/結果を採点エンジンが判定し、「正解です!」等を表示。
   - **解答・解説を見る** — 模範解答とその解説を表示。
4. 演習を完了すると進捗が記録され、マイページの「要復習リスト」等に反映される。

## その他のコマンド

```sh
npm run lint        # ESLint
npm run typecheck    # tsc --noEmit
npm test             # vitest (ユニットテスト)
npm run format       # Prettier整形
npm run format:check # Prettierチェックのみ
```

PRを作成すると `.github/workflows/ci.yml` により上記のtypecheck/lint/testが自動実行される([mobile-workflow.md](mobile-workflow.md)参照)。

## この環境固有の制約(参考)

開発機にXcode/Android Studioのシミュレータ・エミュレータが入っていない場合、方法2(ネイティブシミュレータ)は使えない。その場合は方法1(実機Expo Go)か方法3(Web)で動作確認する。
