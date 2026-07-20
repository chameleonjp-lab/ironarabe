# イロナラベ 公開状態 v2

## 現在の状態

公開URL:

```text
https://chameleonjp.codeberg.page/ironarabe/
```

ユーザーによる公開表示と実プレイ確認済み。

Supabaseは2026年7月20日に条件付きSQLで有効化済み。

```text
game_slug: ironarabe
is_active: true
release_date: 2026-07-20
display_order: 32
top_ranking_type: best
score_order: asc
score_unit: 秒
score_scale: 100
score_decimals: 2
```

有効化直後の確認では、`score_runs`と`game_scores`の`ironarabe`行は0件だった。有効化前に行ったプレイはランキングへ保存されていないため、有効化後の公開ページで改めてクリアする必要がある。

## 次に公開するゲーム版

```text
CLIENT_VERSION: ironarabe-web-1.3.0-official001-v2
```

変更内容:

- ホーム最下部ランキング
- 結果画面ランキング
- 5行表示・30位まで領域内スクロール
- クリア時点でタイム停止
- 完成盤面を4秒表示
- 結果画面へ名前に紐づく初回・ベスト・プレイ回数を表示
- 「移動回数」を「操作回数」へ変更

## 公開手順

1. 実装PRをマージする。
2. マージ後の`index.html`をCodebergの`pages`ブランチ直下へ反映する。
3. iPhoneでホームランキング、プレイ、4秒完成表示、結果ランキングを確認する。
4. 有効化後に1回クリアする。
5. `score_runs`、`game_scores`、ランキング表示を確認する。

## 緊急停止

重大な不具合がある場合はスコア履歴を消さず、一覧と新規送信だけを止める。

```sql
update public.games
set is_active = false
where game_slug = 'ironarabe'
returning game_slug, is_active;
```
