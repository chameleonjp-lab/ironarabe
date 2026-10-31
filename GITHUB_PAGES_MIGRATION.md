# GitHub Pages移行・15言語・効果音

2026-10-31。作業中の受入記録。**新サイト公開・実験場切替・DB更新は未完了**。

## 正本と差分

- GitHub既定ブランチ: `claude/ironarabe-new-game-wlys30`、開始SHA `2e0ef14`。8ステージ、結果画面のみのランキング、再プレイのキャッシュ整理が現行仕様。
- `main` は `3db980a`（旧初回版）、`pages` は `a7ade72`（旧公開用）。本作業に取り込まない。既定ブランチ変更、履歴強制更新、既存ブランチ削除は行わない。
- 正本との差は main: 27 files / +4155,-710、pages: 28 files / +3409,-92。正本にある関連ファイルと7本の既存検証を確認して基準テスト成功。
- Codeberg workflowは手動実行で `pages` と旧1.2.0版を参照していた。これを配備不能な案内に置換し、古い版の再配信を防ぐ。Codebergの既存配信物、リポジトリ、Webhookは変更・停止しない。
- sainome参照SHA: `79b1e5733e725cd1148b10fa5699ba846e2bf57d`。対応ID・native name・locale・browser優先言語規則を継承。

## 追加仕様

4つの同一オリジンJSだけを追加。外部音声・翻訳サービス・有料サービスは使用しない。

- 全15言語でホームから結果、ランキング、通知、共有まで72メッセージを翻訳する。
- 初回の優先言語、保存値、未対応言語時はSainome同様の判定。`ironarabe.language.v1`に手動選択を保存。
- `Intl.NumberFormat`は表示だけに適用。入力名・内部ID・ランキング計算・整数送信値はそのまま。
- `ironarabe.sound.v1`は初期ON。Web Audioの生成/resumeはユーザー操作中のみ。選択、選択取消、交換、完成、結果発表の5音。
- 最終交換の2音が終わる140ms後から短い完成音を鳴らす。結果音は4秒の完成盤面表示後、通信を待たず結果画面へ切り替わる時に鳴らす。
- 同時音声は最大6 oscillator、低gain、短いenvelope、連打間隔制限。OFF/背景/離脱/再プレイ/ホーム移動で予約済みの音も停止。再生失敗はゲームへ伝播しない。
- 再プレイの一時キャッシュ整理では、プレイヤー名・言語・効果音設定を保持し、旧play/request IDを無効化する。端末内の名前はドメイン別のためCodebergからGitHubへ自動コピーされないが、同じ名前を入力すると同じDBランキングへ送信する。

## スコア互換性

変更しない値:

```text
game_slug = ironarabe
score_order = asc
score_scale = 100
score_decimals = 2
CHALLENGE_ID = ironarabe-official-001
BOARD_VERSION = 2
SHUFFLE_SEED = ironarabe-official-001-v1
CLIENT_VERSION = ironarabe-web-1.4.1-stagepack001-v2
```

`sunset-r0`～`sunset-r3`、`aurora-r0`～`aurora-r3`を従来どおりclient_versionのsuffixとして送る。UI公開版だけ別途 `ironarabe-web-1.5.0-i18n-sound-pages` で識別する。

RPC `submit_score(p_display_name,p_game_slug,p_score,p_client_version)` と `get_best_score_ranking(p_game_slug,p_limit)`、引数、結果、10秒timeoutを維持。送信1プレイ1回のガードと再プレイの旧応答無効化を維持し、自動再送を追加しない。共通規約の新RPC移行・開始カウント方式への変更は、今回の「既存方式を完全維持」という利用者指示に従い行わない。既存 `release/ironarabe-game-registration.json` に切替予定URLを記録し、新RPC向けschemaに実態と異なる冪等性を記載したmanifestは作らない。

DBへはSELECTのみ。初回・ベスト・名前・回数・日時・履歴は更新しない。本番試験スコアも送信しない。登録URLの許可対象は `public.games` の `game_slug='ironarabe'` 1件の `game_url` と `share_text` のURL部分だけ。

## GitHub管理画面の設定

調査時 `GET /repos/chameleonjp-lab/ironarabe/pages` は404。新URLも404。接続済みGitHub APIで `POST .../pages {build_type: workflow}` を試したが403 `Resource not accessible by integration`。Actions権限設定の取得も403、environmentは0件。管理権限が不足しているため、以下を管理者が1度だけ行う。公開方式の代替変更はしていない。

1. Repository **Settings → Pages → Build and deployment → Source → GitHub Actions** を選ぶ。
2. **Settings → Actions → General** でActionsを許可し、GitHub公式 `actions/*` が使用可能か確認する。
3. `github-pages` environmentに承認やbranch制限がある場合、現在の既定ブランチからの配備を許可する。承認者必須なら毎回承認待ちになるため、自動配備の運用方針に合わせて設定する。
4. Custom domainは設定しない。旧 `pages` branchを公開元にしない。既定ブランチは変更しない。

個人トークン・Supabase秘密鍵・Codeberg tokenを新workflowへ渡さない。公開jobに `pages: write` と `id-token: write`、checkout/buildは `contents: read` のみ。

## 公開順序とマージ後受入

1. **PR-Aだけ**を利用者が現在の既定ブランチへマージする。PR段階のCIはテスト/buildのみで配備しない。
2. `GitHub Pages` workflowの成功と、`github-pages` environmentのdeployment URLを確認する。成果物は `index.html`、4つのruntime JS、SHAとhashを含む `release.json` だけ。内部資料・テスト・設定・DB文書は公開しない。
3. `release.json` のsource SHAがマージcommitに一致し、各ファイルhashが一致することを公開検証ツールで確認する。HTTP200だけで新版成功としない。
4. 新URLで15言語切替、音設定、開始→完成4秒→結果、既存ランキングの読み取りを確認する。試験プレイの `submit_score` はブラウザの通信mockで遮断する。本番へ試験スコアを送信しない。
5. iPhone 17 Pro Safari縦横の実機で文字欠け、操作、音の聞こえ方、ミュート、背景からの復帰を確認する。実機未確認のまま確認済みとしない。
6. 確認後にPR-Bをreview-readyにし、登録1件の変更前値・予定件数を再確認。PR-Bの手順に沿って認証済み管理権限でURL2列だけ変更し再読取する。実験場はDBを優先するため、新URL公開後の同じ切替時間帯にPR-BマージとDB更新を行う。
7. 以後は修正PRを既定ブランチへマージすると毎回同じworkflowが自動配備。公開用branchへの同期は不要。

## 旧URLの案内

Codeberg Pagesは既存静的HTMLにcanonical、新URLへのリンク、必要ならmeta refreshを置く方法がある。クライアント側転送でありHTTP301の保証はない。Codeberg用tokenや公開物の同期が別途必要になるため、今回は既存サイトを変更しない。新URLの受入後に別作業で実施する。

## 検証・未完了項目

検証結果は最終PR本文と下記の受入記録へ追記する。自動テストは全てローカルまたはmock通信を使用する。

- 新URLの本番公開、公開後の実配備検証: PR-Aマージ待ち。
- 実験場リンクの本番反映、Supabase登録URL: 新URLの公開確認待ち。未適用。
- iPhone 17 Pro実機Safari: 未確認。Playwright WebKit/Chromium縦横を代替確認とし、実機と同等とはみなさない。


### 2026-10-31 ローカル受入記録

- `npm test`: 既存7検証を削除・無効化せず実行し成功。追加Nodeテスト52件成功。
- `npm run test:browser`: Chromium / WebKit、402×874と874×402の4組合せで15言語のホーム・遊び方・ゲーム中・完成・結果の切替、数値/順位、同率順位、ユーザー入力保持、共有先、名前/音/言語の再プレイ・reload保持に成功。
- 両エンジンの追加通信試験: 503失敗表示の全15言語切替、再送なし、再プレイ後に遅れて届く送信/ランキング応答を無効化できることを確認。
- タッチのgesture unlock、ミュートON/OFF、実際のnative AudioContextのoscillator schedulingを確認。Context生成失敗の注入時も開始から結果へ到達。
- 完成音/結果音はそれぞれ1プレイ1回。完成盤面3990ms時点ではプレイ画面、4020ms時点では結果、送信応答が未到着でも結果音呼び出し。音の処理に人工遅延を与えてもクリア保存タイムが変わらないテストを追加。
- ストレージgetter拒否を再現して再プレイ停止を修正。独立レビューでも両getter拒否状態のフルプレイ→再プレイで、名前・言語・音設定のメモリ上の保持を確認。
- 別レビューで15言語の結果画面を320×568・長い名前・大きな数値で確認。縦横のWebKit結果画像も目視確認。
- ローカルWebKit用の不足共有ライブラリはworkspace内へ導入。Playwrightのldconfig判定はworkspaceライブラリを検出しないため、ローカルのみ `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` を使用。ブラウザ試験自体を省略していない。CIは通常の `playwright install --with-deps` を使用。
- 公開物のallowlist buildとhash検証成功。本番のexact-commit buildはcommit後に `--require-clean` でも確認する。
- 敵対的レビュー: 旧branch公開、PR配備、権限、公開物混入、音声失敗、score互換性、設定消去、旧応答混入を確認。未解決の重大指摘なし。READMEの歴史的確認を旧Codeberg版の証拠と明記。
- DB再読取: `game_scores` 29件 digest `440f2cfaee093e2b24d0a51c953251c1`、`score_runs` 567件 digest `e82361709acd36e75fcf012533e944fe`。調査開始時と一致（全列JSONの順序固定MD5）。登録URLは旧URL1件のまま、asc/100/2も維持。DB書込みなし。

以上はローカル試験と読取証拠であり、新URLでの公開後受入ではない。公開成功・本番送信成功・実機Safari成功を主張しない。
