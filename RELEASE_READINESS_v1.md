# イロナラベ 公開準備 v1

## 現在の状態

2026年7月18日時点で、GitHub上のゲーム本体には7×9盤面、名前確認、カウントダウン、ローカル記録、共有、共通`submit_score` RPC連携、盤面の視認性調整が反映されている。

Supabaseの`public.games`には`ironarabe`を事前登録済み。ただし、公開ページをこちらの実行環境から確認できていないため、次の安全な状態にしている。

```text
is_active: false
release_date: null
display_order: 32
```

この状態では実験場のゲーム一覧へ表示されず、`submit_score`も`game not found`として受け付けない。公開URLを確認する前に有効化しない。

登録内容の正本は次のファイルとする。

```text
release/ironarabe-game-registration.json
```

## 公開URL

```text
https://chameleonjp.codeberg.page/ironarabe/
```

Codeberg Pagesは、公開対象リポジトリの`pages`ブランチとWebhookまたはActionsを使って配信する。GitHubの既定ブランチへマージしただけでは、Codeberg Pagesへ自動反映されるとは限らない。

## 公開前ゲート

次を上から順に確認する。途中で失敗した場合は`is_active=false`を維持する。

1. 最新の`index.html`をCodeberg側の公開用ブランチへ反映する。
2. iPhone 17 ProのSafariで公開URLを開き、タイトルとホーム画面が表示されることを確認する。
3. 名前確認、`3 → 2 → 1 → START`、7×9盤面、2タップ交換、リタイアを確認する。
4. 横スクロールがなく、固定印と選択表示を判別できることを確認する。
5. ホームと結果の共有文に公開URLが1回だけ入ることを確認する。
6. `node tools/verify-production-ui.cjs`を実行する。
7. `node tools/verify-release-contract.cjs`を実行する。
8. Supabaseの登録値が正本JSONと一致し、まだ`is_active=false`であることを確認する。
9. ここまで成功した後だけ、Supabaseを有効化する。
10. 実際のプレイヤー名で1回クリアし、結果画面に「ランキングへ登録しました」が出ることを確認する。
11. `score_runs`と`game_scores`へ1件だけ保存され、スコアが1秒=100の整数であることを確認する。
12. 実験場のゲームカード、詳細ランキング、昇順表示、小数2桁表示を確認する。

## Supabase有効化SQL

公開URLと実機操作を確認した後だけ実行する。

```sql
update public.games
set
  is_active = true,
  release_date = current_date
where game_slug = 'ironarabe'
  and game_url = 'https://chameleonjp.codeberg.page/ironarabe/'
  and top_ranking_type = 'best'
  and score_order = 'asc'
  and score_unit = '秒'
  and score_scale = 100
  and score_decimals = 2
returning
  game_slug,
  title,
  game_url,
  is_active,
  release_date,
  score_order,
  score_unit,
  score_scale,
  score_decimals,
  display_order;
```

返却行が0件の場合は有効化できていない。条件を外して強制更新せず、登録値のずれを確認する。

## 緊急停止SQL

公開後に進行不能、誤ったランキング換算、通信の多重送信などが見つかった場合に使う。

```sql
update public.games
set is_active = false
where game_slug = 'ironarabe'
returning game_slug, is_active;
```

停止しても既存のスコア履歴は削除しない。

## 公開後の確認SQL

```sql
select
  game_slug,
  title,
  game_url,
  is_active,
  release_date,
  top_ranking_type,
  score_order,
  score_unit,
  score_scale,
  score_decimals,
  score_label,
  first_score_label,
  best_score_label,
  display_order
from public.games
where game_slug = 'ironarabe';
```

```sql
select
  normalized_name,
  display_name,
  score,
  client_version,
  created_at
from public.score_runs
where game_slug = 'ironarabe'
order by created_at desc
limit 10;
```

```sql
select
  normalized_name,
  display_name,
  first_score,
  best_score,
  play_count,
  updated_at
from public.game_scores
where game_slug = 'ironarabe'
order by best_score asc, updated_at asc
limit 10;
```

## 難易度について

現在の公式seedは次のまま維持する。

```text
ironarabe-official-001-v1
```

候補A・B・Cの比較ラボは用意済みだが、人間による3候補の比較結果がまだない。公開前に公式seedを変更しない。変更する場合は、既存ランキングとの混在、`CHALLENGE_ID`、`BOARD_VERSION`、`CLIENT_VERSION`、ローカル保存キーを別作業で決める。

## 未確認

- Codeberg Pagesの公開URLが現在200で応答すること
- iPhone 17 Pro実機での最新版操作
- 実Supabase RPCの成功
- 本番DBへの初回保存
- 実験場カードと詳細ランキングへの表示
- 候補A・B・Cの人間による比較
