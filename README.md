# イロナラベ

色のグラデーションタイルを正しい位置へ並べ替える、スマホ向けタイムアタックパズルです。7列×9行の盤面で、動かせるタイルを2枚ずつ選んで交換します。

## 遊び方

1. ホームの「ゲームを始める」から、任意でプレイヤー名を入力します。ランキングに登録する場合だけ名前が必要です。
2. 全8ステージから1つが選ばれます。
3. `3 → 2 → 1 → START`の後に盤面と計測が始まります。
4. 動かせるタイルを2枚選ぶと交換され、操作回数が1増えます。
5. 右上に印のある8枚は固定タイルで動かせません。
6. 全タイルを正しい位置へ戻すと、その操作時点でタイムが止まります。
7. 完成盤面を4秒表示した後、結果画面へ進みます。

## 8ステージ

- `夕映え`: 0°・90°・180°・270°
- `極光`: 0°・90°・180°・270°

8ステージをシャッフルバッグ方式で選び、同じバッグ内では重複しません。固定座標、タイルID、動かせるタイルの初期並び、公式シャッフルseedは全ステージで共通です。

## ホーム画面

ホームはゲーム開始を優先します。

- 開始・遊び方・シェア
- 全8ステージ表示
- イロナラベの詳細ランキングへの導線

ホーム画面にはランキングと端末ローカルベストを表示しません。ページ初期化時とホーム復帰時にはランキング取得RPCを実行しません。

## 結果画面

結果画面は全プレイヤーにベストタイム上位30名を表示します（5行分の領域をスクロールして30行まで閲覧可能）。名前ありの場合は、Supabaseの登録名に紐づく情報も表示します。

- 登録名
- 登録名の初回記録
- 登録名のベスト記録
- 登録名のプレイ回数
- ステージ
- 操作回数
- ベストタイムランキング

ランキングは上位5行が基本表示され、領域内スクロールで30位まで閲覧できます。

## 再プレイ時の軽量化

「もう一度遊ぶ」を押した時は、保存済みのプレイヤー名・言語・効果音設定を残し、次を消去します。

- 名前・言語・効果音設定以外の`ironarabe.` localStorage
- `ironarabe.` sessionStorage
- タイル、正解配列、盤面配列、固定集合
- メモリ上のランキング結果
- 結果画面のランキングDOMと登録名表示

Supabaseのスコア履歴は削除しません。未送信の匿名開始回数queueは再プレイで消さず、同じ開始UUIDで再送します。

## ランキング契約

- `game_slug`: `ironarabe`
- 短いタイムほど上位 (`score_order: asc`)
- 保存値: 1秒=100の整数
- 表示: 秒・小数2桁
- スコア送信: 名前ありでクリアした時に1回だけ。名前なしでは送信しない。
- 取得: 結果画面で`get_best_score_ranking`を30件
- `p_client_version`: 基本版＋ステージID
- 認証: Publishable keyを`apikey`ヘッダーに使用
- secret key、service_role key、Bearer認証は使用しません

## 15言語と効果音

ホーム上部の言語メニューは、初回にブラウザの優先言語を使い、手動選択を端末へ保存します。対応ID・言語名・判定規則はサイノメ現行版に合わせています。

`ja`, `en`, `es`, `pt-BR`, `zh-Hans`, `fr`, `de`, `ko`, `ru`, `it`, `zh-Hant`, `id`, `tr`, `vi`, `th`

画面・通知・共有文・ステージ名・数値表示を再読み込みせず切り替えます。入力された名前、スコア保存値、ステージIDは変換しません。

Web Audio APIで選択・キャンセル・交換・完成・結果発表の5音を生成します。初期値はONで、ホームと結果画面から変更できます。利用者操作で音声を有効化し、設定は再プレイ後も維持します。音声が使えなくてもプレイできます。

## 公開状況（切替準備・未公開）

```text
https://chameleonjp-lab.github.io/ironarabe/
```

上記は移行先の正式URLです。2026-10-31の作業時点ではHTTP 404で、稼働確認は未完了です。PR-Aマージ後の公開確認を経て実験場・Supabaseを切り替えます。

現在稼働中の旧公開先は `https://chameleonjp.codeberg.page/ironarabe/` です。今回停止・削除しません。

GitHub Pagesは `.github/workflows/github-pages.yml` で、既定ブランチ `claude/ironarabe-new-game-wlys30` へのマージ後に自動配備します。PRでは検証のみ実行し、本番配備しません。公開設定と順序は [GITHUB_PAGES_MIGRATION.md](./GITHUB_PAGES_MIGRATION.md) を参照してください。

Supabase登録は有効なまま維持します。登録URLは公開確認後まで旧URLのままです。

```text
is_active: true
release_date: 2026-07-20
display_order: 32
score_order: asc
score_unit: 秒
score_scale: 100
score_decimals: 2
```

旧Codeberg版での公開後の実プレイについて、`score_runs` 1件、`game_scores` 1件、名前単位のプレイ回数1回を確認済みです。

基本版識別子:

```text
ironarabe-web-1.4.1-stagepack001-v2
```

## 検証

```bash
npm ci
npm test
npx playwright install --with-deps chromium webkit
npm run test:browser
npm run build

# 個別の既存検証も引き続き実行可能:
node tools/verify-stage-pack-v13.cjs
node tools/verify-result-only-v14.cjs
```

## ドキュメント

- 今回の追加仕様・公開手順: [GITHUB_PAGES_MIGRATION.md](./GITHUB_PAGES_MIGRATION.md)
- ゲームの基本仕様: [SPEC_v4.md](./SPEC_v4.md)
- 現在の確認項目: [REVIEW_CHECKLIST_v4.md](./REVIEW_CHECKLIST_v4.md)
- 旧Codeberg版の確認記録: [RELEASE_STATUS_v3.md](./RELEASE_STATUS_v3.md)
- 旧Codeberg公開設定（履歴）: [CODEBERG_PUBLISH_SETUP_v1.md](./CODEBERG_PUBLISH_SETUP_v1.md)
- 旧Codeberg公開確認（履歴）: [PUBLICATION_VERIFICATION_v1.md](./PUBLICATION_VERIFICATION_v1.md)
- Supabase登録の切替予定値（DB未適用）: [release/ironarabe-game-registration.json](./release/ironarabe-game-registration.json)
- Supabaseプリフライト結果: [release/supabase-preflight-v1.json](./release/supabase-preflight-v1.json)
- 難易度比較: [DIFFICULTY_STUDY_v1.md](./DIFFICULTY_STUDY_v1.md)
- 旧仕様: [SPEC_v3.md](./SPEC_v3.md)、[REVIEW_CHECKLIST_v3.md](./REVIEW_CHECKLIST_v3.md)、[RELEASE_STATUS_v2.md](./RELEASE_STATUS_v2.md)


## 任意名と名前なしのプレイ回数（追加仕様）

名前欄は空欄でも開始可能です。保存名がある場合も「名前なしで遊ぶ」を選べます。この選択で保存済みの名前は消えません。

名前ありは従来どおりクリア時に既存ランキングへ送信します。名前なしは実際にプレイ画面へ進んだ時点で専用RPCへ開始回数だけを送信し、名前・スコア・参加者・順位を作りません。回数の未送信記録は端末に保存し、reload/online/次回開始で同じUUIDを再送するため、通信断からの再送で二重計上されません。

この追加機能には [PR-B #37](https://github.com/chameleonjp-lab/chameleonjp_lab/pull/37) の `ironarabe-guest-play-count.sql` 適用が必要です。追加SQLは現時点で本番未適用で、匿名回数の本番計測を確認済みとは扱いません。追加SQLを管理者が適用してから本体を公開し、URL2列切替SQLは新サイトの公開後受入が済んでから適用します。
