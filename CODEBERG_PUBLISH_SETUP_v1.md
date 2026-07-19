# イロナラベ Codeberg公開設定 v1

## 目的

GitHubの`pages`ブランチを、iPhoneからGitHub Actionsを手動実行してCodebergの`pages`ブランチへ同期する。

正式な公開URL:

```text
https://chameleonjp.codeberg.page/ironarabe/
```

この仕組みは公開ファイルの同期だけを行う。Supabaseの`is_active`は変更しない。

## 前提

Codeberg側に次のリポジトリが存在すること。

```text
https://codeberg.org/chameleonjp/ironarabe
```

存在しない場合、先にCodeberg上で空のリポジトリを作成する。GitHub Actionsからリポジトリを自動作成しない。

## Codeberg PagesのWebhook

Codebergの`chameleonjp/ironarabe`で次を設定する。

1. リポジトリの`Settings`を開く。
2. `Webhooks`を開く。
3. `Add webhook`からForgejo形式を選ぶ。
4. Target URLへ次を入れる。

```text
https://chameleonjp.codeberg.page/ironarabe/
```

5. Branch filterを`pages`にする。
6. Webhookを保存する。

Webhookがない場合、`pages`ブランチを更新しても公開ページが更新されない。

## Codebergアクセストークン

Codebergのユーザー設定から、専用のPersonal Access Tokenを作成する。

- 用途が分かる名前にする。例: `github-ironarabe-pages`
- `chameleonjp/ironarabe`へpushできる最小限のリポジトリ書き込み権限だけを付ける
- 管理者権限や不要な権限を付けない
- 作成直後に値を安全な場所へ保存する
- トークンをリポジトリ、Issue、Pull Request、チャットへ貼らない

## GitHub Actions Secrets

GitHubの`chameleonjp-lab/ironarabe`で次を開く。

```text
Settings
→ Secrets and variables
→ Actions
→ New repository secret
```

次の2つを登録する。

### `CODEBERG_USERNAME`

Codebergでpush権限を持つユーザー名。

### `CODEBERG_TOKEN`

上で作成したCodeberg Personal Access Token。

トークンはWorkflow本文や通常の変数へ直書きしない。

## 最初の接続確認

GitHubの`Actions`から`Publish Codeberg Pages`を開き、`Run workflow`を選ぶ。

入力:

```text
confirmation: VERIFY
dry_run: true
```

この実行ではpushしない。次だけを確認する。

- GitHubの`pages`ブランチを取得できる
- 公開対象4ファイルの契約が正しい
- Secretsが設定されている
- Codebergリポジトリへ認証できる
- Codeberg側の現在の`pages` SHAを取得できる

失敗した場合は、Supabaseを有効化せず、Actionsの失敗ステップを確認する。

## 実際の公開

接続確認が成功した後だけ、もう一度`Run workflow`を開く。

入力:

```text
confirmation: PUBLISH
dry_run: false
```

公開実行は、GitHubの`pages`ブランチをCodebergの`pages`ブランチへ同期する。

Codeberg側の`pages`が既に存在する場合は、実行開始時に取得したSHAをleaseとして使う。別の更新が途中で入った場合は上書きせず失敗する。

## 公開後確認

Safariで次を順に開く。

```text
https://chameleonjp.codeberg.page/ironarabe/release.json
https://chameleonjp.codeberg.page/ironarabe/
https://chameleonjp.codeberg.page/ironarabe/tools/difficulty-lab.html
```

`release.json`で次を確認する。

```text
client_version: ironarabe-web-1.2.0-official001-v2
challenge_id: ironarabe-official-001
board_version: 2
source_index_blob: 34924ded8610a300e76dca6b7890a6799ded3645
```

ゲーム画面では次を確認する。

- タイトルが「イロナラベ」
- ホームが表示される
- 名前確認へ進める
- `3 → 2 → 1 → START`
- 7×9盤面
- 2タップ交換
- 固定印が見える
- 交換反応が操作を妨げない
- リタイアでホームへ戻る
- 横スクロールがない

ここまで成功するまでSupabaseの`is_active=false`を維持する。

## Supabase有効化の条件

次がすべて確認できた後だけ有効化する。

1. GitHub Actionsの公開実行が成功
2. 公開`release.json`が期待値と一致
3. iPhone 17 Proで基本操作が成功
4. 進行不能や表示崩れがない
5. `RELEASE_READINESS_v1.md`の条件付きSQLと登録値が一致

有効化後は実際に1回クリアし、ランキング送信、`score_runs`、`game_scores`、実験場表示を確認する。

## 緊急停止

公開後に重大な問題を見つけた場合は、まずSupabaseだけを非公開へ戻す。

```sql
update public.games
set is_active = false
where game_slug = 'ironarabe'
returning game_slug, is_active;
```

既存のスコア履歴は削除しない。

## ワークフローの安全条件

`.github/workflows/publish-codeberg-pages.yml`は次を保証する。

- `workflow_dispatch`だけで動く
- dry runが既定値
- dry runは`VERIFY`、実公開は`PUBLISH`の確認文字が必要
- `pages`以外を公開しない
- 公開対象4ファイルを事前検査する
- Secrets未設定では停止する
- Codebergリポジトリへ接続できなければ停止する
- Codeberg側に別更新が入った場合はlease不一致で停止する
- Supabaseを変更しない
