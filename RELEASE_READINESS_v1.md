# イロナラベ 公開準備 v1

## 現在の状態

2026年7月18日時点で、GitHub上のゲーム本体には7×9盤面、名前確認、カウントダウン、ローカル記録、共有、共通`submit_score` RPC連携、盤面の視認性と交換反応の調整が反映されている。

Supabaseの`public.games`には`ironarabe`を事前登録済み。ただし、Codeberg Pagesの公開URLとiPhone実機操作を確認できていないため、次の安全な状態を維持している。

```text
is_active: false
release_date: null
display_order: 32
```

この状態では実験場のゲーム一覧へ表示されず、通常の`submit_score`は`game not found`として受け付けない。公開URLを確認する前に有効化しない。

登録内容の正本:

```text
release/ironarabe-game-registration.json
```

DBプリフライト結果:

```text
release/supabase-preflight-v1.json
```

## 完了したSupabaseプリフライト

本番DBへテスト行を残さないため、1つのトランザクション内だけで`ironarabe`を一時的に有効化し、最後に`ROLLBACK`した。

確認結果:

- `public.submit_score(text,text,integer,text)`が`accepted=true`を返した。
- 初回プレイとして`is_first_play=true`、`is_new_best=true`を返した。
- 別SQL文で`score_runs`へ1件、`game_scores`へ1件が見えることを確認した。
- `p_score`は整数として保存された。
- `client_version`が`score_runs`へ保存された。
- `get_best_score_ranking`が1位の行を返した。
- `get_first_try_ranking`が1位の行を返した。
- `get_game_ranking`が1位の行を返した。
- `get_game_play_stats`が`player_count=1`、`total_play_count=1`を返した。
- 最後にロールバックし、`games.is_active=false`、`release_date=null`へ戻った。
- `score_runs`、`game_scores`、`players`にテスト行が0件であることを確認した。

この確認で、DB関数、保存先、読み取りRPCの契約は確認できた。ただし、公開ページ上のJavaScriptからREST APIを呼ぶブラウザ経路、CORS、実プレイの1回送信は未確認である。

## 公開URL

```text
https://chameleonjp.codeberg.page/ironarabe/
```

Codeberg Pagesは、公開対象リポジトリの`pages`ブランチとWebhookまたはActionsを使って配信する。GitHubの既定ブランチへマージしただけでは、Codeberg Pagesへ自動反映されるとは限らない。

## 残る公開ゲート

次を上から順に確認する。途中で失敗した場合は`is_active=false`を維持する。

1. 最新の`index.html`をCodeberg側の公開用`pages`ブランチへ反映する。
2. iPhone 17 ProのSafariで公開URLを開き、タイトルとホーム画面が表示されることを確認する。
3. 名前確認、`3 → 2 → 1 → START`、7×9盤面、2タップ交換、リタイアを確認する。
4. 横スクロールがなく、固定印、選択表示、140msの交換反応を判別できることを確認する。
5. ホームと結果の共有文に公開URLが1回だけ入ることを確認する。
6. `node tools/verify-production-ui.cjs`を実行する。
7. `node tools/verify-release-contract.cjs`を実行する。
8. Supabaseの登録値が正本JSONと一致し、まだ`is_active=false`であることを確認する。
9. ここまで成功した後だけ、Supabaseを有効化する。
10. 公開ページから実際のプレイヤー名で1回クリアし、結果画面に「ランキングへ登録しました」が出ることを確認する。
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
- 公開ページのJavaScriptからREST RPCが成功すること
- 本番プレイのスコアが1回だけ保存されること
- 実験場カードと詳細ランキングへの表示
- 候補A・B・Cの人間による比較
