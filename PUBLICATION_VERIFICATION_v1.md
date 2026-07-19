# イロナラベ 公開反映の自動確認 v1

## 目的

`Publish Codeberg Pages`の実公開を、Codebergの`pages`ブランチへpushできた時点では成功扱いにしない。

次の3段階がすべて成功した場合だけ、GitHub Actionsを成功にする。

1. Codebergの`pages`ブランチがGitHubの`pages`ブランチと同じSHAになった。
2. 公開`release.json`が期待する版情報になった。
3. 公開`index.html`が期待するゲーム版、公式問題、タイトルを含む。

この確認はSupabaseを有効化しない。

## 対象URL

```text
https://chameleonjp.codeberg.page/ironarabe/
https://chameleonjp.codeberg.page/ironarabe/release.json
```

## 期待する公開版

```text
game_slug: ironarabe
client_version: ironarabe-web-1.2.0-official001-v2
challenge_id: ironarabe-official-001
board_version: 2
source_index_blob: 34924ded8610a300e76dca6b7890a6799ded3645
shuffle_seed: ironarabe-official-001-v1
```

## Workflowの動作

### Dry run

```text
confirmation: VERIFY
dry_run: true
```

認証、公開対象、push権限を確認する。Codebergへ書き込まず、公開URLの変更待ちも行わない。

### 実公開

```text
confirmation: PUBLISH
dry_run: false
```

実公開では次を行う。

1. GitHubの`pages`をCodebergの`pages`へ`force-with-lease`で同期する。
2. Codeberg側のブランチSHAを再取得し、GitHub側と完全一致することを確認する。
3. 公開URLへキャッシュ回避用のクエリを付けてアクセスする。
4. `release.json`と`index.html`を最大18回確認する。
5. 各試行の間を20秒空け、最大約6分待つ。
6. 期待版へ到達した場合だけWorkflowを成功にする。
7. 結果をGitHub ActionsのStep Summaryへ表示する。

Codeberg Pagesは更新反映まで数分かかる場合があるため、最初の404や旧版表示だけでは直ちに失敗確定にしない。

## 成功条件

公開`release.json`で次が一致する。

- `game_slug`
- `client_version`
- `challenge_id`
- `board_version`
- `source_index_blob`

公開`index.html`で次が確認できる。

- `<title>イロナラベ</title>`
- 期待する`CLIENT_VERSION`
- 期待する`CHALLENGE_ID`
- 期待する`SHUFFLE_SEED`

## 失敗時の読み方

### Codeberg repository accessで失敗

次を確認する。

- `CODEBERG_USERNAME`
- `CODEBERG_TOKEN`
- Codeberg側の`chameleonjp/ironarabe`
- トークンのリポジトリ書き込み権限

### push permissionで失敗

トークンにpush権限がないか、Codeberg側のブランチ保護と競合している。

### branch SHA verificationで失敗

push直後のCodeberg `pages`がGitHubの`pages`と一致していない。別更新との競合またはpush失敗を確認する。

### public version verificationで失敗

Codeberg側ブランチは更新済みでも、公開ページが期待版へ到達していない。

確認対象:

- Codeberg Pages用Webhookが存在するか
- Target URLが正式URLか
- Branch filterが`pages`か
- Webhookの直近配信結果
- Codeberg Pagesのキャッシュ更新待ち
- 公開`release.json`が旧版のままではないか

この失敗時もSupabaseは有効化しない。

## Workflow成功後に残る人間確認

Workflow成功は、公開ファイルと版の一致までを示す。次は代行できないためiPhone 17 ProのSafariで確認する。

- ホーム表示
- 名前確認
- `3 → 2 → 1 → START`
- 7×9盤面
- 2タップ交換
- 固定印
- 140msの交換反応
- リタイア
- 横スクロールなし
- ホームと結果の共有文

この実機確認が成功するまでは`public.games.is_active=false`を維持する。

## Supabaseとの境界

このWorkflowは次を行わない。

- `public.games.is_active`の変更
- `release_date`の変更
- テストスコア送信
- 本番スコア削除
- 実験場の表示切り替え

Supabase有効化は`RELEASE_READINESS_v1.md`の条件付きSQLを別途実行する。
