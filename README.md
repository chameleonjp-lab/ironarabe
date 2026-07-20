# イロナラベ

色のグラデーションタイルを正しい位置に並べ替えるスマホ向けタイムアタックパズルです。7列 × 9行（63マス）の盤面で、動かせるタイルを2つずつ選んで交換し、すべてを正しい位置へ戻すまでのタイムを競います。

## 遊び方

1. ホームの「ゲームを始める」からプレイヤー名確認へ進みます。
2. 名前を確認すると `3 → 2 → 1 → START` の後に盤面と計測が始まります。
3. 動かせるタイルを2枚選ぶと位置が交換され、操作回数が1増えます。
4. 右上に印のある8枚は固定タイルで動かせません。
5. 全タイルを正しい位置へ戻すと、その時点でタイムが止まります。
6. 完成した盤面を4秒表示した後、結果画面へ進みます。

## 特徴

- 公開用ゲームは `index.html` 1ファイルで動作します。
- 7×9、固定8枚、公式seed固定、タイルID一致による正解判定です。
- ホームと結果画面にベストタイムランキングを表示します。
- ランキングは上位5行が基本表示され、エリア内スクロールで30位まで閲覧できます。
- 結果画面には端末のプレイ回数ではなく、Supabaseに保存された「この名前の初回記録・ベスト記録・プレイ回数」を表示します。
- ホームには、この端末だけに保存されたローカルベストも区別して表示します。
- ホームと結果画面から共有できます。

## ランキング契約

- `game_slug`: `ironarabe`
- 良い方向: 短いほど上位 (`score_order: asc`)
- 保存値: 1秒=100の整数
- 表示: 秒、小数2桁
- 送信: クリア時に1回だけ
- 取得: `get_best_score_ranking` で30件
- 認証: Publishable keyを `apikey` ヘッダーに使用
- secret key / service_role key / Bearer認証は使用しません

## 公開状況

公開URL:

```text
https://chameleonjp.codeberg.page/ironarabe/
```

2026年7月20日にSupabaseの登録を有効化済みです。

```text
is_active: true
release_date: 2026-07-20
display_order: 32
score_order: asc
score_unit: 秒
score_scale: 100
score_decimals: 2
```

有効化前のプレイは保存されていません。ランキング記録を作るには、有効化後の公開ページで改めてクリアする必要があります。

## 検証

```bash
node tools/verify-production-ui.cjs
node tools/verify-ranking-ui-v12.cjs
node tools/verify-release-contract.cjs
node tools/verify-codeberg-publish-workflow.cjs
```

## ドキュメント

- 現在の仕様: [SPEC_v3.md](./SPEC_v3.md)
- 現在の確認項目: [REVIEW_CHECKLIST_v3.md](./REVIEW_CHECKLIST_v3.md)
- 現在の公開状態: [RELEASE_STATUS_v2.md](./RELEASE_STATUS_v2.md)
- 旧公開前ゲート: [RELEASE_READINESS_v1.md](./RELEASE_READINESS_v1.md)
- Codeberg公開設定: [CODEBERG_PUBLISH_SETUP_v1.md](./CODEBERG_PUBLISH_SETUP_v1.md)
- 公開反映の自動確認: [PUBLICATION_VERIFICATION_v1.md](./PUBLICATION_VERIFICATION_v1.md)
- Supabase登録値の正本: [release/ironarabe-game-registration.json](./release/ironarabe-game-registration.json)
- Supabaseプリフライト結果: [release/supabase-preflight-v1.json](./release/supabase-preflight-v1.json)
- 難易度比較: [DIFFICULTY_STUDY_v1.md](./DIFFICULTY_STUDY_v1.md)
- 旧仕様: [SPEC_v2.md](./SPEC_v2.md)、[REVIEW_CHECKLIST_v2.md](./REVIEW_CHECKLIST_v2.md)
