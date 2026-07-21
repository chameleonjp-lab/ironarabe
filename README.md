# イロナラベ

色のグラデーションタイルを正しい位置へ並べ替える、スマホ向けタイムアタックパズルです。7列×9行の盤面で、動かせるタイルを2枚ずつ選んで交換します。

## 遊び方

1. ホームの「ゲームを始める」からプレイヤー名を確認します。
2. 全8ステージから1つが選ばれます。
3. `3 → 2 → 1 → START`の後に盤面と計測が始まります。
4. 動かせるタイルを2枚選ぶと交換され、操作回数が1増えます。
5. 右上に印のある8枚は固定タイルで動かせません。
6. 全タイルを正しい位置へ戻すと、その操作時点でタイムが止まります。
7. 完成盤面を4秒表示した後、結果画面へ進みます。

## 8ステージ

ステージは2つの配色系列と4方向の組み合わせです。

- `夕映え`: 現行配色を0°・90°・180°・270°へ時計回りに配置
- `極光`: 別の8固定色を持つ配色を0°・90°・180°・270°へ時計回りに配置

8ステージをシャッフルバッグ方式で選び、同じバッグ内では重複しません。バッグを使い切った直後も、前回と同じステージが連続しないようにします。

固定座標、タイルID、動かせるタイルの初期並び、公式シャッフルseedは全ステージで共通です。そのため必要な交換構造は同一で、配色と方向だけが変わります。色の見分けやすさには個人差があり得るため、送信時の`client_version`へステージIDを付け、後からステージ別に監査できるようにしています。

## UI

- ホームの開始・遊び方ボタンを専用グループにまとめ、上余白とボタン内余白を調整しています。
- ホームに「全8ステージ・毎回ランダム」を表示します。
- カウントダウン、プレイHUD、完成表示、結果、シェア文にステージ情報を表示します。
- ホームと結果画面にベストタイムランキングを表示します。
- ランキングは上位5行が基本表示され、領域内スクロールで30位まで閲覧できます。
- 結果画面にはSupabaseに保存された、この名前の初回記録・ベスト記録・プレイ回数を表示します。

## ランキング契約

- `game_slug`: `ironarabe`
- 短いタイムほど上位 (`score_order: asc`)
- 保存値: 1秒=100の整数
- 表示: 秒・小数2桁
- 送信: クリア時に1回だけ
- 取得: `get_best_score_ranking`で30件
- `p_client_version`: 基本版＋ステージID
- 認証: Publishable keyを`apikey`ヘッダーに使用
- secret key、service_role key、Bearer認証は使用しません

## 公開状況

公開URL:

```text
https://chameleonjp.codeberg.page/ironarabe/
```

Supabase登録は有効です。

```text
is_active: true
release_date: 2026-07-20
display_order: 32
score_order: asc
score_unit: 秒
score_scale: 100
score_decimals: 2
```

公開後の実プレイ1件について、`score_runs` 1件、`game_scores` 1件、名前単位のプレイ回数1回を確認済みです。

8ステージ版の基本版識別子:

```text
ironarabe-web-1.4.0-stagepack001-v2
```

## 検証

```bash
node tools/verify-production-ui.cjs
node tools/verify-ranking-ui-v12.cjs
node tools/verify-stage-pack-v13.cjs
node tools/verify-release-contract.cjs
node tools/verify-codeberg-publish-workflow.cjs
```

## ドキュメント

- 現在の仕様: [SPEC_v4.md](./SPEC_v4.md)
- 現在の確認項目: [REVIEW_CHECKLIST_v4.md](./REVIEW_CHECKLIST_v4.md)
- 現在の公開状態: [RELEASE_STATUS_v3.md](./RELEASE_STATUS_v3.md)
- Codeberg公開設定: [CODEBERG_PUBLISH_SETUP_v1.md](./CODEBERG_PUBLISH_SETUP_v1.md)
- 公開反映の自動確認: [PUBLICATION_VERIFICATION_v1.md](./PUBLICATION_VERIFICATION_v1.md)
- Supabase登録値の正本: [release/ironarabe-game-registration.json](./release/ironarabe-game-registration.json)
- Supabaseプリフライト結果: [release/supabase-preflight-v1.json](./release/supabase-preflight-v1.json)
- 難易度比較: [DIFFICULTY_STUDY_v1.md](./DIFFICULTY_STUDY_v1.md)
- 旧仕様: [SPEC_v3.md](./SPEC_v3.md)、[REVIEW_CHECKLIST_v3.md](./REVIEW_CHECKLIST_v3.md)、[RELEASE_STATUS_v2.md](./RELEASE_STATUS_v2.md)
