# スマホ(GitHubアプリ)だけで開発を進める手順

GitHubモバイルアプリには「閲覧・Issue/PR管理・レビュー・マージ」機能はあるが、コードの編集・コミット機能はない。
そこで、実際のコード実装は **Claude CodeのGitHub Actions連携**(`/install-github-app`で導入)に任せ、
スマホ側では「指示出し」と「レビュー・マージ」だけを行う。

## 前提セットアップ(初回のみ、PCで実施)
1. ローカルのClaude Codeセッションで `/install-github-app` を実行し、このリポジトリ(`maruyamamtk/linux_app`)にClaude GitHub Appをインストールする。
2. ブラウザでのGitHub App認可を完了させる。
3. `.github/workflows/` にClaude Code用のワークフローファイルが追加されていることを確認する。

## 日常の開発フロー(スマホのみ)
1. **GitHubアプリでIssueを開く**
   - 「Assigned to you」または `phase:1` ラベルで一覧を絞り込む(例: #1 Expoプロジェクトの雛形構築)
2. **Issueにコメントして実装を依頼する**
   - コメント欄に `@claude` を含めて依頼内容を書く
   - 例: `@claude このIssueの内容を実装してPRを作成してください`
   - 複雑なIssueは一度に丸投げせず、「まずXXまでやってください」のように区切ると精度が上がる
3. **GitHub Actionsが起動し、Claude Codeが実装・PR作成**
   - 通知が届くまで数分〜待つ(アプリの通知タブで進捗を確認可能)
4. **PRの差分をスマホでレビュー**
   - GitHubアプリの「Pull requests」タブから対象PRを開き、Files changedで差分を確認
   - `.github/PULL_REQUEST_TEMPLATE.md` のチェックリストを参照しながら確認する
5. **修正が必要な場合は追加コメント**
   - PR上で `@claude ここを直してください: ...` のようにコメントすると再修正を依頼できる
6. **問題なければ承認してマージ**
   - GitHubアプリ上で「Approve」→「Merge pull request」

## 注意事項
- Claudeが作成したPRも、必ず人間(自分)がレビューしてからマージする(ブランチ保護でレビュー1件を必須化済み)。
- 大きすぎるIssueは実装精度が落ちやすいため、`docs/requirements.md` のIssue粒度(機能単位)を大きく超える追加要望は、必要に応じてIssueを分割してから依頼する。
- CI(Lint/テスト)は Issue #1(Expoプロジェクト雛形構築)完了後に整備され、以降はブランチ保護のステータスチェック必須化も追加する予定。
