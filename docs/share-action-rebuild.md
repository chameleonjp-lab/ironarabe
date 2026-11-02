# シェア操作の再作成

既存 anchor 2個と旧 click handler を撤去し、home/result それぞれ標準の type=button と単一 controller を作り直しました。復元元は merge commit `222a62b2ffa2102c25901dad9adb5d63133d7fa5`（PR26 head `d08f250942aa3383d6cf4c3954e290eb1366a38e`）です。

- 黒地白字、翻訳ラベル、現在の結果・言語、正式 URL と #イロナラベ #ゲーム制作 を保持。
- Enter/Space/touch は native button の click に集約。500ms 内の連打は1操作扱い、次の操作は再試行可能。非表示画面に残るボタンからの誤呼出しは phase で拒否。
- 新windowを同期生成し opener を切り離して noreferrer の self-navigation。不能時だけ同じ共有文の手動コピー prompt、常設copyなし。修正前 anchor の middle/modified click のリンク操作は native button の動作に置換。
- arbitrary CSS を強制解除する処理や !important による再表示は追加していません。本人 iPhone で旧 X が消えた根本原因は未確定のままで、今回の再作成とは区別します。
- スコア・ルール・ID・送信条件は不変更。本人画像を公開資料へ使いません。

検査は外部通信 mock/deny の CI で実施します。15言語・縦横の home/result、44px/中心hit/全領域/祖先clip、keyboard/touch/連打/失敗fallback/no-Referer と score再送なしを確認します。実機・公開配信は別確認です。
