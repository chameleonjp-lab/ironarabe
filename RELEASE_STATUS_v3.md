# イロナラベ 公開状態 v3

## 現在の公開状態

公開URL:

```text
https://chameleonjp.codeberg.page/ironarabe/
```

Supabase:

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

公開後の実プレイについて、次を確認済み。

```text
score_runs: 1件
game_scores: 1件
名前単位プレイ回数: 1回
```

ランキング送信、登録名記録、結果ランキングの基本経路は本番データで成立している。

## 次に公開するゲーム版

```text
CLIENT_VERSION: ironarabe-web-1.4.1-stagepack001-v2
```

スコア送信時は末尾にステージIDを付与する。

```text
-sunset-r0
-sunset-r1
-sunset-r2
-sunset-r3
-aurora-r0
-aurora-r1
-aurora-r2
-aurora-r3
```

## 変更内容

- ホーム画面のランキング領域を削除
- ページ初期表示時のランキング取得を削除
- ホーム復帰時のランキング取得を削除
- ホーム画面の端末ローカルベストを削除
- 結果画面はSupabaseの登録名記録を表示
- 結果画面だけにベストタイムランキングを表示
- 再プレイ時に保存名以外のアプリキャッシュを消去
- 8ステージ、4秒完成表示、操作回数を維持

## キャッシュ方針

永続保存するゲーム情報は、現行プレイヤー名だけとする。

```text
ironarabe.v2.playerName
```

「もう一度遊ぶ」では次を削除する。

- 名前以外の`ironarabe.` localStorage
- `ironarabe.` sessionStorage
- タイル、正解配列、盤面配列、固定集合
- メモリ上のランキング配列
- 結果ランキングDOM
- 前プレイの登録名表示

保存名、Supabaseのスコア履歴、ステージの重複防止に必要なシャッフルバッグは維持する。

## ランキング方針

ランキングは結果画面だけで取得・表示する。

- ホーム表示前のネットワーク待機をなくす。
- 結果画面遷移時に最大30件取得する。
- スコア送信成功後に再取得する。
- 既存ランキングは維持する。
- ステージID付き`client_version`でステージ別監査を可能にする。

## 公開手順

1. PR #14をマージする。
2. マージ後の最新版`index.html`だけをCodebergの`pages`ブランチ直下へ反映する。
3. iPhone 17 Proでホームがランキング通信なしですぐ操作可能になることを確認する。
4. クリア後、登録名のベスト記録と結果ランキングを確認する。
5. 「もう一度遊ぶ」で名前だけが残り、前回ランキング表示が消えることを確認する。
6. 新版スコアの`client_version`へステージIDが保存されることを確認する。

## 緊急停止

重大な不具合がある場合も履歴は削除せず、公開一覧と新規送信だけを停止する。

```sql
update public.games
set is_active = false
where game_slug = 'ironarabe'
returning game_slug, is_active;
```
