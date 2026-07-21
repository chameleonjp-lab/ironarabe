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

ランキングと名前記録の基本経路は本番データで成立している。

## 次に公開するゲーム版

```text
CLIENT_VERSION: ironarabe-web-1.4.0-stagepack001-v2
```

各スコア送信時は末尾にステージIDを付与する。

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

変更内容:

- ホームの開始・遊び方・シェアボタンの余白調整
- 夕映え4方向
- 極光4方向
- 全8ステージからシャッフルバッグ方式で選択
- カウントダウン・HUD・完成表示・結果・シェアへのステージ表示
- ステージID付き`client_version`

## ランキング互換方針

既存のランキングは維持する。

全ステージで次を共通にする。

- 固定座標
- タイルID
- 正解位置
- 動かせる55枚の初期ID配列
- 公式シャッフルseed
- 計時とスコア換算

色系列による体感差はあり得るため、ステージID付き`client_version`で監査可能にする。公開後にステージ別の記録分布を確認し、著しい差が出る場合はランキング分離または配色調整を別判断する。

## 公開手順

1. PR #13をマージする。
2. マージ後の最新版`index.html`だけをCodebergの`pages`ブランチ直下へ反映する。
3. iPhone 17 Proでホーム余白、ステージ表示、8ステージ選択を確認する。
4. 新版でクリアし、`score_runs.client_version`にステージIDが保存されることを確認する。
5. 既存ランキング1件が維持され、名前記録と総合ランキングが更新されることを確認する。

## 緊急停止

重大な不具合がある場合も履歴は削除せず、公開一覧と新規送信だけを停止する。

```sql
update public.games
set is_active = false
where game_slug = 'ironarabe'
returning game_slug, is_active;
```
