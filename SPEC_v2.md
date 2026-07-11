# イロナラベ SPEC v2

## この版で維持するゲームの核

- 7列×9行、合計63マスの色並べタイムアタック。
- 四隅と各辺中央の合計8枚は固定タイルで、正解位置から動かせない。
- 可動タイル2枚を順番にタップして交換する。同じタイルを再タップすると選択解除する。
- 正解判定は色ではなくタイルIDで行う。
- 固定シードで全端末の初期配置を同じにする。
- リタイア時はランキングへ送信しない。
- 移動回数は副記録で、ランキング値はクリアタイムとする。

## 公式チャレンジ定数

- `GAME_SLUG`: `ironarabe`
- `CHALLENGE_ID`: `ironarabe-official-001`
- `BOARD_VERSION`: `2`
- `CLIENT_VERSION`: `ironarabe-web-1.0.0-official001-v2`

`OFFICIAL_CHALLENGE.id` は `CHALLENGE_ID` を参照し、値がずれない構造にする。

## スコア仕様

- 内部計測の正本はミリ秒整数。
- Supabaseへ保存する値は、1秒を100として表す整数。
- 変換は `elapsedMsToScore(ms) = Math.round(ms / 10)` とする。
- 表示は送信値と一致するよう、小数2桁の秒表示にする。
- 例: `72,438ms` → 送信値 `7,244` → 表示 `72.44秒`。
- `p_score` は有限の正の整数だけを送る。`NaN`、`Infinity`、0以下は送らない。
- ホームのローカルベスト、プレイ中タイム、結果タイム、シェア文は小数2桁で揃える。
- `lastResult` は既存形式どおりミリ秒を保存してよい。

## Supabaseランキング送信契約

送信先は共通RPCのみを使う。

```text
POST {SUPABASE_URL}/rest/v1/rpc/submit_score
```

ヘッダーは次の名前だけを使う。

```text
Content-Type: application/json
apikey: {SUPABASE_PUBLISHABLE_KEY}
```

本文は次の4項目を基本契約とする。

```json
{
  "p_display_name": "プレイヤー名",
  "p_game_slug": "ironarabe",
  "p_score": 7244,
  "p_client_version": "ironarabe-web-1.0.0-official001-v2"
}
```

Publishable key以外の秘密鍵、service role key、Bearer認証、`public.game_scores` への直接INSERT、ゲーム専用RPC、旧本文キー（`game_slug`、`player_name`、`score`、`challenge_id`）は使わない。

## 設定判定と表示

- `SUPABASE_URL` と `SUPABASE_PUBLISHABLE_KEY` が有効に設定されている場合だけ `fetch()` を呼ぶ。
- 未設定時は `fetch()` を呼ばず、結果画面に「ランキングは未設定です」と表示する。
- 表示状態は次を区別する。
  - `idle`: 未送信
  - `submitting`: ランキング送信中…
  - `success`: ランキングへ登録しました
  - `failed`: ランキング送信に失敗しました
  - `unconfigured`: ランキングは未設定です

## 1プレイ1送信と非同期競合対策

- 新しいプレイごとに `playId` を更新する。
- クリア時に対象プレイの `playId` を保存し、そのプレイについて1回だけ送信する。
- 送信結果を画面へ反映する前に現在の `playId` と一致するか確認する。
- 前回プレイの遅い通信結果は、次のプレイや次の結果画面へ反映しない。
- リタイア時は絶対に送信しない。
- タイムアウトは `SCORE_SUBMIT_TIMEOUT_MS = 10000` ミリ秒とし、失敗してもゲーム本体と結果画面を壊さない。

## 実Supabase疎通の確認状況

この作業時点では `SUPABASE_PUBLISHABLE_KEY` は指定されたが、`SUPABASE_URL` はリポジトリ内や作業環境で確認できなかったため未設定。実Supabaseへの送信、RPC登録、`ironarabe` のDB側登録、保存済み本番スコアの有無は未確認。

公開準備の回で、DB側の `public.games` と実験場側も `score_scale=100`、`score_decimals=2` に揃える前提。

## 今回変更していない事項

難易度、盤面サイズ、色、固定位置、シャッフルシード、カウントダウン、名前入力方式、ホーム導線、実験場リンク、交換演出、画面構成、レイアウト、タイルデザイン、選択演出は変更しない。
