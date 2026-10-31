# 任意名・匿名回数・詳細ランキングの追加計画

**Spec:** 利用者の追加依頼: タッケウ同様に名前は任意、ランキングに載せたい人だけ名前を入力、名前なしも回数計測、実験場リンクは当ゲーム詳細ランキング、結果に上位30名。
**Architecture:** 既存8ステージ/15言語/5音/PagesのPR-A#16に追記。名前ありのsubmit_score/asc100/2を維持し、匿名開始は専用private表+UUID冪等RPCで別集計。PR-B#37には未適用SQLと検証・公開順序を追記。
**Reference:** takkeu mainのguestPlays.ts/controller.tsと20261024095634_takkeu_guest_play_count.sql。名前なしは開始時1件、名前あり既存送信はクリア時。偽の名無しユーザー/ダミースコアは作らない。

## 制約・判断
- 名前入力は開始前に任意（タッケウと同じ）。空欄でも開始でき、保存名ありでも「名前なしで遊ぶ」で匿名開始可能。匿名選択は保存名を消さない。
- 匿名プレイはスコア未送信、初回・ベスト・参加人数・順位を変更しない。既存名前あり記録は従来のクリア時の送信とカウントを維持する。
- 未送信匿名開始はstart_id/client_versionだけを永続queueへ保存し、reload/online/次回開始に同じIDで再送。再プレイの不要キャッシュ整理から除外する。保存不能時はmemoryで処理。
- 新しいprivate表と限定RPCが必要。既存タッケウ専用RPCやrecord_game_playへの偽名送信はしない。
- DB本番スコア書込みなし、旧29名/567履歴のhashを前後比較。追加SQLはPRでレビュー可能にし、本番適用・公開の未実施を明記する。
- 既定branch変更・直接push・merge・force・旧branch削除なし。既存2PRの作業branchへ追記。

## Tasks
- [x] タッケウ/現行DB定義とPR最新状態の調査。両PR未merge、既存scorehash前回と一致。
- [x] js/guest-plays.js: UUID、保存queue、並行再送、応答検証、失敗隔離のRED→GREEN。
- [x] index.html: 名前任意、匿名開始・登録除外表示、詳細リンク、上位30DOMの実表示・スクロール確認。既存namedbrowser試験を維持し匿名全工程を追加。
- [x] js/messages.json/translations.js: 追加文言を15言語対応。
- [x] Pages allowlistにlocal guest scriptを追加、各既存検証を新仕様へ更新。
- [x] lab: private匿名table/RPC/共通total加算だけの安全な追加SQLと分離試験。既存score/ランキング/他ゲーム不変。
- [x] 既存全検証、Chromium/WebKit縦横、30名、匿名reload再送、named回帰、独立レビュー。
- [ ] 2PR更新、CI成功、未公開/未適用/実機未確認と次手順を報告。


## 追加検証・レビュー記録
- 本体 `npm test`: 既存7検証 + Node86テスト成功（guest queue32件、body deadline2件を含む）。
- Chromium/WebKit縦横の名前あり回帰、匿名フルプレイ、全15言語、上位30名の描画/最終行到達、保存名保持、未送信queue保持に成功。両エンジンの通信失敗/旧応答隔離と、online競合/reload同一UUID再送も成功。合計12ブラウザシナリオ。
- lab `npm test`: 既存catalog/Takkeu/URL検証 + 隔離PGlite DB15テスト成功。公開read-only45ゲーム検証成功。
- 独立レビュー3件を修正。RPC本文完了までdeadline維持、online時は明示recoverオプションで1回だけfollowup、失敗で停止した全待機rowへfailed通知。各再現テストRED→GREEN。
- DB再読取: 29名/567履歴、MD5両方が追記前と一致。本番DB書込みなし。匿名追加SQL/URL切替SQLは未適用。
- 実機iPhone17Pro Safariは未確認。新サイト公開とDB適用は未完了のまま、既存2PRを更新する。
