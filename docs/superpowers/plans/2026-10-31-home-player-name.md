# ホームで名前を入力し、1回で開始する実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 任意の名前入力をホームへ移し、「ゲームを始める」1回で既存のカウントダウンへ進む。
**Architecture:** 現在の名前確認画面をホームの入力欄へ統合し、開始・Enter・名前なしボタンを同じ開始処理へ接続する。再プレイは保存名・言語・音・未送信queueを保持してホームへ戻す。
**Tech Stack:** 現行HTML/CSS/JavaScript、Node test、Playwright Chromium/WebKit。
**Spec:** 利用者の「名前の入力欄はホーム画面、ゲームを始めるですぐ始める」という指定。名前は任意、保存名ありでも明示的な匿名開始を残す。

## Global Constraints
- 基点は最新既定branch2977122。main/pagesへ切替、直接push、自動mergeは行わない。
- 40問・既存63色/ID/seed/boardVersion、ランキングironarabe/asc/100/2、RPCと本番DBを変更しない。
- 15言語と5音、空欄時の匿名回数、保存名/言語/音、未送信queue、非同期応答の重複防止を保つ。

## Review Focus
- 初回/保存名ありのホームで入力と開始がすぐ操作でき、自動でキーボードを出さない。
- 21文字、空欄、前後空白、IME確定Enter、連続クリックで誤開始・重複開始しない。
- 匿名開始だけが実プレイ開始時に1回数えられ、名前ありの旧送信方式はそのまま。
- 再プレイ/リタイア/遅い通信で保存名・言語・音と未送信queueが失われない。
- 15言語と縦横で名前欄/主ボタンが欠けず、開始時に入力focusが残らない。

## Task: ホーム開始フロー
**Files:** index.html、test/browser.cjs、既存2つのUI verifier、公開UI版のmetadata/test/package、README。
**Interfaces:** ホームのplayerNameInputを消費し、開始ボタン/Enter/guestStartから既存preparePlay→startCountdownへ進む。新しい本番テスト用hookは追加しない。
- [x] ホーム入力と即countdown、保存/無名/IME/連打を実ブラウザで検証するテストを先に書き、旧画面でREDを確認。
- [x] 名前確認画面をホームへ統合。保存名復元、inline validation、input blur、開始のphase guard、再プレイ帰還を実装。
- [x] 既存14シナリオの操作経路を新しいホームへ更新し、検証内容を保持。全40問クリアも継続。
- [x] Node全検証、Chromium/WebKit縦横・15言語、score契約を実行し、独立レビュー。
- [x] feature branchでPRを提出できる状態まで検証。PR番号・CI・確定SHAの成果物検査はPR本文へ記録する。公開は利用者のmerge後であり、本番DBは操作しない。

## 検証記録

旧UIでホームの入力欄が非表示になるREDを確認し、統合後GREEN。SafariのIME確定でisComposing=false/keyCode229になる場合もREDを確認し、確定Enterで誤開始しないよう修正した。既存7検証とNode97/97、Chromium/WebKit計16シナリオ（既存14＋新規2）が成功。40問ずつの計80クリアも継続。通信は全件mockし、本番スコア/回数を送信していない。

独立レビューでは重要な実行時の問題なし。READMEの保存設定に関する旧検証が要求する語句が欠けていたため復元し、全npm testを再実行して成功。レビュー側のlocalhost bind EPERMはsandboxによるもので、親のnetwork許可付き実行では97/97成功した。実機iPhone17Pro Safariは未確認。

縦/横のWebKit画像はdocs/home-name-portrait.png、docs/home-name-landscape.png。UI公開識別子だけを1.6.1-home-nameへ更新し、スコア用CLIENT_VERSION・DB・40問の識別子は変更しない。

目視確認でWebKitのnative言語メニューが白地に淡い文字となっていたため、selectだけにcolor-scheme:darkを指定した。新しいホーム開始2シナリオを両engineで再実行し、WebKit画像で文字が読めることを確認した。

## 追加依頼: X専用の共有

利用者の追加指定で、ホームの日本語共有を「イロナラベ\n色の流れを見ながら、7×9のタイルを正しい場所へ並べよう。\nhttps://chameleonjp-lab.github.io/ironarabe/」の3行へ変更する。ホーム/結果の「Xでシェアする」は黒地・白字とし、X Web Intentの投稿画面を開くリンクにする。15言語と結果のステージ/タイム/操作数を維持し、言語切替と結果表示時にリンクを更新する。新しい外部SDK、APIキー、DB変更、自動投稿は追加しない。

- [x] 旧ボタンにXリンクが無いREDを確認後、直接投稿画面を開くanchorとURLエンコードを実装。
- [x] ボタン文言とホーム3行文を15言語へ追加。日本語は指定文と完全一致。
- [x] 既存16シナリオにX専用2シナリオを追加し、XとSupabase通信を差し替えて全文/色/実popup/現在スコア/言語更新を検証。全18シナリオとNode97件成功。
- [x] 独立レビューで重大指摘なし。確定SHAのclean buildとPR/CI結果はPR本文へ記録する。

作業中に利用者がPR20をmergeしたため、最新の5fb3682からfeat/x-sharingを作り、X共有だけの追加PRへ分けた。UI公開版は1.6.2-x-share、スコアclient_versionは従来のまま。既存ベストと今回のスコアが異なるfixtureでも、Xへ今回のタイムを渡すことを検証する。Xの投稿画面へのリクエストは全件差し替え、実投稿・本番DB書込みは0件。

