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
- `CLIENT_VERSION`: `ironarabe-web-1.2.0-official001-v2`
- `GAME_URL`: `https://chameleonjp.codeberg.page/ironarabe/`（公開予定URL）
- `LAB_URL`: `https://chameleonjp.codeberg.page/chameleonjp_lab/`

`OFFICIAL_CHALLENGE.id` は `CHALLENGE_ID` を参照し、値がずれない構造にする。

## 画面状態と遷移

画面状態は `home`、`nameConfirm`、`countdown`、`playing`、`result` の5つとする。DOM表示、`state.phase`、`body[data-phase]` は `setPhase(nextPhase)` で揃える。

許可する主な遷移:

- `home → nameConfirm`
- `nameConfirm → home`
- `nameConfirm → countdown`
- `countdown → nameConfirm` または `home`（中断・次プレイ準備時）
- `countdown → playing`
- `playing → home`（リタイア）
- `playing → result`（クリア）
- `result → nameConfirm`（もう一度遊ぶ）
- `result → home`

盤面操作は `state.phase === 'playing' && state.inputLocked === false && state.cleared === false` の時だけ受け付ける。クリア確定後は演出待機中で `state.phase` が一時的に `playing` でも、リタイア処理を受け付けない。ホームへ戻る共通処理はカウントダウン、交換、クリア待機、通知など画面をまたぐ待機処理を解除する。

## ホームと名前確認

ホームには、ゲーム名、一文説明、「ゲームを始める」、開閉式の「遊び方」、「ゲームをシェア」、「カメレオンJPの実験場へ」、この端末のベスト記録、ローカル記録である説明を置く。ホームにプレイヤー名入力欄を常時表示しない。

名前確認画面では、プレイヤー名を前後空白除去後に1文字以上20文字以下で検査する。日本語、英数字、絵文字、記号を許可する。空欄や20文字超過は画面内エラーとし、勝手に「ゲスト」へ置き換えない。可能な環境では `Intl.Segmenter` で見た目の1文字に近い単位を数え、代替として `Array.from(value).length` を使う。

保存済みの名前がある場合は入力欄へ入れて再利用できる。Enterキーでも確認できるが、日本語入力の変換中は `isComposing` を確認して開始しない。名前確定時は、検査、`state.playerName` への保存、安全な保存関数経由での端末保存、入力欄の `blur()`、残フォーカス解除、カウントダウンへの遷移を行う。名前は `textContent` など安全な値として扱う。

## カウントダウンと計時開始

名前確定後、`3 → 2 → 1 → START` の順に表示する。表示時間は `COUNTDOWN_STEP_MS = 700` と `COUNTDOWN_START_MS = 300` で調整できる。

カウントダウン中はゲーム画面・盤面DOMを表示しない。盤面を半透明、ぼかし、背後表示、`visibility:hidden` 条件表示で見せる作りにしない。盤面DOM生成は `playing` へ移る直前に行う。

二重開始防止として、`state.phase`、確定ボタンの `disabled`、カウントダウントークン、タイマーID配列、`clearCountdownTimers()` を使う。古い `setTimeout` はホームへ戻る時、リタイア時、別プレイ開始時に解除または無効化する。

`START` 表示が終わった後の `requestAnimationFrame` で `renderBoard()`、`setPhase('playing')`、`state.startTime = performance.now()`、`state.elapsedMs = 0`、`state.inputLocked = false`、`requestAnimationFrame(tick)` を行う。名前入力中・カウントダウン中は計測せず、START前に `state.startTime` を設定しない。記録の正本は `performance.now() - state.startTime` で、表示は小数2桁とする。

## 見た目と操作感

この版では、ゲームルール、色、固定位置、公式seedを変えずに、盤面を読み取りやすくする。

- タイル間隔は `2px` とし、色の連続性を見やすくする。
- タイル角丸は `4px` とし、各色面の面積を確保する。
- 固定タイルの印は中央を覆わず、右上の小さな丸で示す。
- 選択中の拡大率は `1.025` とし、隣の色を隠しにくくする。白い枠と控えめな明るさでも選択を示す。
- 2枚を交換した直後は、対象2枚だけに `140ms` の短い交換反応を付ける。
- 交換反応中は `state.inputLocked = true` とし、3枚目の入力や重複交換を受け付けない。
- 交換終了後、同じ `playId` のプレイ中であることを確認してから、クリア判定または入力解除を行う。
- `swapTimerId` は新しいプレイ、ホーム復帰、リタイア、クリア、ページ離脱時に解除する。
- 動きを減らす設定が有効な場合は、交換待ちを入れずに同じ処理結果へ進み、CSSの遷移とアニメーションもほぼ無効にする。
- HUDは高さと装飾を減らし、盤面を優先する。TIMEとMOVESの意味、値、スコア計算は変えない。
- 通常画面では盤面幅を画面幅と高さの両方から決め、短い画面では説明文を隠して盤面とリタイア操作を優先する。
- 幅360px以下では左右余白と結果記録の文字を調整する。

交換アニメーションは見た目だけを補助する。移動回数は従来どおり交換成立時に1増え、ランキングはクリアタイムだけで決まる。

## ローカル保存

localStorage の読み書きはすべて `safeStorageGet(key)`、`safeStorageSet(key, value)`、`safeStorageRemove(key)` を通し、例外を処理する。保存を拒否するブラウザ設定でもゲームは起動し、現在の1プレイを最後まで遊べる。壊れた数値やJSON、`NaN`、`Infinity`、0以下は採用しない。

新しい保存キー:

- `ironarabe.v2.playerName`: 最後に確認した名前
- `ironarabe.v2.official001.firstScore`: この端末で最初にクリアした記録（1秒=100の整数）
- `ironarabe.v2.official001.bestScore`: この端末の最短記録（1秒=100の整数）
- `ironarabe.v2.official001.playCount`: 実際に `playing` へ入った回数。リタイアを含む
- `ironarabe.v2.official001.lastResult`: 最後にクリアした結果JSON

`lastResult` には `playerName`、`elapsedMs`、`score`、`moves`、`challengeId`、`boardVersion`、`clientVersion`、`at` を保存する。

旧キー `ironarabe.playerName`、`ironarabe.bestTimeMs`、`ironarabe.lastResult` は削除しない。新キーが空の場合だけ、旧プレイヤー名が有効なら新 `playerName` へ、旧 `bestTimeMs` が有限の正の数なら `elapsedMsToScore()` で新 `bestScore` へ移行する。旧データから初回記録や正確なプレイ回数は推測しない。

初回記録は最初のクリア時だけ保存する。ベスト記録は初回クリア時または保存済みベストより小さい時だけ更新する。バッジは初めてのクリアで「初回記録」、2回目以降の更新で「ベスト更新！」、更新なしは表示しない。

## 結果画面

結果画面には、今回の記録、この端末の初回記録、この端末のベスト記録、この端末のプレイ回数、移動回数、初回記録またはベスト更新表示、ランキング送信状態、結果をシェア、もう一度遊ぶ、ホームへ戻る、カメレオンJPの実験場へのリンクを表示する。ローカル記録には「この端末の記録」と明記し、サーバーランキングと誤解させない。

クリア時は `state.cleared = true`、`state.inputLocked = true`、リタイアボタン無効化、タイマー停止、最終時間確定、既存クリア演出、対象 `playId` 保存、結果画面の1回表示、ローカル記録更新、結果画面を先に使える状態にする、ランキング送信開始の順で処理する。新しいクリア待機を設定する前に古い `clearTimerId` を解除し、待機処理の実行時は `clearTimerId` を `null` に戻す。`showResult()` 直前に `playId` を確認し、`state.resultShownPlayId` で同一クリアの二重処理を防ぐ。クリア確定後はリタイア不可とし、通常プレイ中のリタイアだけホームへ戻す。

## シェアと導線

ホームシェア文は次を基本とする。

```text
イロナラベ
色の流れを見ながら、7×9のタイルを正しい場所へ並べよう。
https://chameleonjp.codeberg.page/ironarabe/
```

結果シェア文は次を基本とする。

```text
イロナラベ
公式チャレンジを{タイム}秒・{移動回数}回でクリア！
https://chameleonjp.codeberg.page/ironarabe/
```

共有は Web Share API、Clipboard API、一時 `textarea` コピーの順で試す。Web Share API が成功した場合は追加通知を出さない。共有キャンセルはエラー扱いせず、勝手にコピーへ進めない。共有キャンセル以外の Web Share 失敗、または Web Share API がない場合はコピー処理へ進む。Clipboard API が存在して失敗した場合も、その時点で失敗確定にせず一時 `textarea` コピーへ切り替える。成功時は「シェア文をコピーしました」、Clipboard API と一時 `textarea` の両方が失敗した時だけ「コピーできませんでした」を `aria-live` のトーストで通知する。ホーム通知と結果通知は独立したタイマーで管理し、画面を離れる時は対象画面の古い通知文とエラー表示を消す。共有テキストには `GAME_URL` を1回だけ入れ、ローカルURLは使わない。

ホームと結果画面の両方に、`LAB_URL` へ向かう実際の `a` 要素「カメレオンJPの実験場へ」を置く。

## スコア仕様

- 内部計測の正本はミリ秒整数。
- Supabaseへ保存する値は、1秒を100として表す整数。
- 変換は `elapsedMsToScore(ms) = Math.round(ms / 10)` とする。
- 表示は送信値と一致するよう、小数2桁の秒表示にする。
- 例: `72,438ms` → 送信値 `7,244` → 表示 `72.44秒`。
- `p_score` は有限の正の整数だけを送る。`NaN`、`Infinity`、0以下は送らない。

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
  "p_display_name": "確認済みのプレイヤー名",
  "p_game_slug": "ironarabe",
  "p_score": 7244,
  "p_client_version": "ironarabe-web-1.2.0-official001-v2"
}
```

Publishable key以外の秘密鍵、service role key、Bearer認証、`public.game_scores` への直接INSERT、ゲーム専用RPC、旧本文キー（`game_slug`、`player_name`、`score`、`challenge_id`）は使わない。

## 設定判定と表示

- `SUPABASE_URL` と `SUPABASE_PUBLISHABLE_KEY` が有効に設定されている場合だけ `fetch()` を呼ぶ。
- 未設定時は `fetch()` を呼ばず、結果画面に「ランキングは未設定です」と表示する。
- 表示状態は `idle`、`submitting`、`success`、`failed`、`unconfigured` を区別する。

## 1プレイ1送信と非同期競合対策

- 新しい挑戦ごとに `playId` を1回だけ更新する。
- クリア時に対象プレイの `playId` を保存し、そのプレイについて1回だけ送信する。
- 送信結果を画面へ反映する前に現在の `playId` と一致するか確認する。
- 前回プレイの遅い通信結果は、次のプレイや次の結果画面へ反映しない。
- リタイア時は絶対に送信しない。
- タイムアウトは `SCORE_SUBMIT_TIMEOUT_MS = 10000` ミリ秒とし、失敗してもゲーム本体と結果画面を壊さない。

## 実Supabase疎通の確認状況

`index.html` のクライアント設定には Supabase URL と Publishable key を反映済み。キー実値はこの文書へ書かない。

共通RPC契約は維持しているが、本番ランキングを汚す検証スコアは送信していない。そのため、実Supabaseへの疎通、RPC正常応答、スコア保存成功、`public.games` への `ironarabe` 登録状況、実験場ランキングへの反映は未確認。

## 第4回で変更しない範囲

第4回では、タイル間隔、角丸、固定印、選択表示、交換反応、HUD、短い画面対応だけを調整する。難易度、盤面サイズ、固定タイル数、四隅の色、シャッフルシード、タイルIDによる正解判定、スコア換算、Supabaseランキング契約、`GAME_URL`、`LAB_URL`、ローカル保存キーは変更しない。

## 今回未実装の項目

難易度候補の本番採用、盤面サイズ変更、色変更、固定位置変更、シャッフルシード変更、リタイア確認、音、振動、ヒント、ドラッグ操作、オンラインランキング一覧取得、Supabase表/RPC/SQL変更、実験場側コード変更、Codeberg Pages公開、キーボードでの盤面操作対応は未実装。
