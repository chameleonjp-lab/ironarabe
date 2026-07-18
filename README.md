# イロナラベ

色のグラデーションタイルを正しい位置に並べ替えるスマホ向けタイムアタックパズルです。7列 × 9行（63マス）の盤面で、シャッフルされたタイルを2つずつタップして入れ替え、すべてを正しいグラデーション位置に戻すまでのタイムを競います。

## 遊び方
1. `index.html` をブラウザで開く（外部依存なし・単一ファイル）。
2. ホームの「ゲームを始める」からプレイヤー名確認へ進みます。
3. 名前を確認すると `3 → 2 → 1 → START` の後に盤面が表示され、計測が始まります。
4. 2つの動かせるタイルを順番にタップすると入れ替わります。
5. 印（●）のあるタイルは固定で、動かせません（手がかりです）。
6. すべてを正しい位置に戻すとクリアし、結果画面に進みます。

## 特徴
- 単一ファイル（HTML / CSS / JavaScript のみ）。npm・フレームワーク・外部素材・CDN 不使用。
- ホームと結果画面から共有できます。共有URLは `https://chameleonjp.codeberg.page/ironarabe/` を使います。
- この端末内の初回記録、ベスト記録、プレイ回数、最後の結果を localStorage に保存して表示します。
- 四隅の色から RGB 線形補間で 7×9 のグラデーションを生成します。
- 正解判定は色ではなくタイルIDで行い、丸め誤差の影響を受けません。
- 公式チャレンジは固定シードの疑似乱数でシャッフルするため、どの端末でも初期配置が同一です。
- 固定タイル8マス（四隅・各辺中央）は常に正解位置です。

## ランキング連携について
`index.html` 内の `RANKING_CONFIG` に Supabase URL と Publishable key を設定し、共通 `submit_score` RPC へランキングを送信します。**secret key は使いません。**
通信失敗時もゲーム本体は動作し、結果画面に控えめな失敗表示を出すだけです。

- game_slug: `ironarabe`
- 内部計測はミリ秒、ランキング送信値は1秒=100の整数、表示は小数2桁です。
- 送信はクリア時のみ・1プレイ1回です。

## 公開状況

Supabaseの `public.games` には、公開前の安全な状態で事前登録済みです。

```text
is_active: false
release_date: null
display_order: 32
```

DB関数、`score_runs`、`game_scores`、ランキング読み取りRPCは、ロールバック前提のトランザクションで検証済みです。テスト行は残っていません。

公開URLとiPhone実機の操作を確認した後だけ有効化します。公開手順、確認SQL、緊急停止SQLは [RELEASE_READINESS_v1.md](./RELEASE_READINESS_v1.md) を参照してください。GitHubからCodebergへ同期する初期設定と実行方法は [CODEBERG_PUBLISH_SETUP_v1.md](./CODEBERG_PUBLISH_SETUP_v1.md) を参照してください。登録値の正本は [release/ironarabe-game-registration.json](./release/ironarabe-game-registration.json)、DBプリフライト結果は [release/supabase-preflight-v1.json](./release/supabase-preflight-v1.json) です。

## 検証

```bash
node tools/verify-production-ui.cjs
node tools/verify-release-contract.cjs
```

## ドキュメント
- 現在の仕様: [SPEC_v2.md](./SPEC_v2.md)
- 現在の確認項目: [REVIEW_CHECKLIST_v2.md](./REVIEW_CHECKLIST_v2.md)
- 公開前ゲート: [RELEASE_READINESS_v1.md](./RELEASE_READINESS_v1.md)
- Codeberg公開設定: [CODEBERG_PUBLISH_SETUP_v1.md](./CODEBERG_PUBLISH_SETUP_v1.md)
- Supabase登録値の正本: [release/ironarabe-game-registration.json](./release/ironarabe-game-registration.json)
- Supabaseプリフライト結果: [release/supabase-preflight-v1.json](./release/supabase-preflight-v1.json)
- 難易度比較: [DIFFICULTY_STUDY_v1.md](./DIFFICULTY_STUDY_v1.md)
- 初回実装時の旧文書: [SPEC.md](./SPEC.md)、[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)
