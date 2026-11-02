# SNS 共有と表示の確認

## 固定画像
- `assets/social-preview.png` は1200×630の固定紹介画像。既存 `loadGameStages` / `buildTiles` の第1盤面を完成配置で表示し、配色・7×9タイル・固定位置マークを保持する。実プレイ結果やランキング画面ではない。
- `tools/render-social-preview.cjs` が編集可能なSVGを生成。PNGは同SVGをシステムlibrsvg/cairoで描画。AI生成・外部素材・プレイヤー名・スコアを使用しない。
- Open Graph/Twitter画像URLは既存GitHub Pages正式URL配下。画像は公開ファイルallowlistとreleaseのSHA-256整合検査に含め、JavaScript扱いをしない。SNS側のカード表示/キャッシュは配信後確認が必要。

## 共有文・操作領域
15言語のホーム/結果に `#イロナラベ #ゲーム制作` を1回ずつ追加。現在結果を保持し、URLは最後の行。長い結果数値で保守的280文字検査を行う。
ランキングリンクは現公開ホームで高さ24pxを確認したため、既存2箇所の `.panel-link` のみ高さ44px以上に拡大。Xが見えない本人症状の原因修正と混同しない。

## 模擬表示受入
15言語 × 縦横 × ホーム/結果 × Chromium/WebKitでX・ランキングの可視性/祖先透明度/44px/中心ヒットを確認しPNG保存。tap intentはmockで捕捉し外部投稿なし。全外部HTTPをmock/deny、Service WorkerとWebSocketを遮断。display:none/親opacity:0は対照として拒否する。
本人Safariの原因や実機での解決は未確認。SNS公開カードの受入はマージ後。
