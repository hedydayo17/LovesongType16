# CLAUDE.md — 音楽診断プロジェクト 起動時briefing

このファイルは Claude Code 起動時に自動で読み込まれる。新セッション開始時はまずこれを読んで全体状況を把握すること。

---

## このプロジェクトは何か

オンライン診断サイト「**ラブソング診断16**」。
MBTI / 動物占い的なオンライン診断 + その人専用の楽曲レコメンド。TikTokシェア前提・モバイル最優先。

詳細は [README.md](./README.md) 参照。

---

## 必ず読むべきファイル(順番)

1. [README.md](./README.md) — プロジェクト全体像とステータス
2. [types.md](./types.md) — 16タイプ確定リスト + パロディ名 + 命名思想
3. [rules.md](./rules.md) — 命名原則 / 体験設計原則 / CEOモード自走範囲
4. [roadmap.md](./roadmap.md) — Phase 1〜8 の計画と進捗
5. [decisions.md](./decisions.md) — 時系列の決定事項ログ(必読)

---

## 現在の状態(更新:2026-06-19)

- **Phase 1**(コンセプト・16タイプ・パロディ名):完了
- **Phase 2**(質問設計):完了。**プロトは16P式スケール×20ステートメントに移行**(正本=`app/js/questions.js`)。旧15問4択は [questions.md](./questions.md) にアーカイブ
- **Phase 3**(タイプ詳細解説):**全16タイプを「これ私すぎる」水準に全面リライト**(2026-06-19)。正本=`app/js/data.js`
- **Phase 4**(レコメンドエンジン):**ロジックはモックで実装済**。本番Spotify接続は未(ファウンダー判断)
- **Phase 5**(ビジュアル):**全身SVGキャラ×16**(`app/js/mascot.js`)+ タイプ別カラー。**正式イラスト発注用ブリーフ作成済み**([illustration_brief.md](./illustration_brief.md))。発注先選びはファウンダー判断
- **Phase 6**(実装):**動くプロトタイプ + 拡散性UP 仕掛けまで完成** → [app/](./app/)。`cd app && python3 -m http.server 8765` で起動
- **Phase 7〜8**(テストプレイ・本番公開):未着手

### プロトタイプ現状(2026-06-19 v7 時点)
- 見た目=**ラブタイプ64寄りの明るいポップ系**(白基調・丸み・Zen Maru Gothic + Yomogi・シール装飾)+ **PC/スマホ両対応**(PC時は中央スマホ枠デバイス + 両脇背景FX)
- 回答=**16P式「そう思う⇔思わない」7段階スケール × 20問**(正本 `app/js/questions.js`)+ 触覚フィードバック(`navigator.vibrate`)
- 結果=**「◯◯系 × タイプ」二層命名(64通り)** の**1枚キャラカード** + スクロールリビール(GSAP+ScrollTrigger+Lenis) + 多セクション(解説/恋愛傾向%バー/強み/愛されポイント/理想/あるある5個/相性◎△/10曲) + 16タイプ図鑑
- 拡散仕掛け=**結果カードPNG自動生成**(html2canvas + Web Share API)/ LINE・Xシェア / 相性シェア / 再シャッフル / 👍👎(localStorage)
- タイポグラフィ磨き済(`clamp` + `palt` + 視認性 text-shadow)、マイクロインタラクション磨き済(脈打ち選択ドット / btn :active / スピナー)
- モーション=`app/js/motion.js`(`MX`)。GSAP/Lenis/html2canvas は `app/js/vendor/` にセルフホスト。GSAP無し/reduce-motion でも内容は表示するフォールバック有り
- **未実装(ファウンダー判断必須)**:正式キャライラスト発注(ブリーフ提出済み)/ Spotify本番接続(APIキー・規約)/ 本番公開(デプロイ・選曲承認)/ 信頼感の本物化(監修者プロフ・実績バッジ・診断数実データ)

### 動かし方
`cd app && python3 -m http.server 8765` → `http://localhost:8765/index.html`。詳細は [app/README.md](./app/README.md)。
※ 開発中の変更が反映されない時はURL末尾に `?fresh=1` 等を付けてHTMLを強制再取得(JS/CSSは `?v=` 付与済み)。

### セッション設定メモ
- 2026-06-18:`.claude/settings.local.json` に `model: claude-opus-4-7` を設定(反映は再起動後。プラン非対応なら既定にフォールバック)。permissions allowlist も設定済み(削除系のみ確認)。

## 確定済みアーキテクチャ

- **入力設計**:診断前に「**Step 0:生年月日(YYYY/MM/DD)入力 [必須・カード非表示・年齢推測表記NG]** + **Step 0a:18ジャンル選択(1〜5) [Skip可]** + **Step 0b:好きなアーティスト3組入力 [Skip可]**」
- **タイプ判定**:20問の16P式スケール → 回答位置(±)×タイプ重みで集計、合計最高タイプ。+「系」を重ねて64通り
- **楽曲レコメンド**:Spotify Web API + LLM(Claudeで各曲にタイプ適合度スコア)+ ランダム10曲抽出(現状はモック楽曲68曲)
- **結果ページ**:「別の10曲を見る」ボタン搭載(再シャッフル)
- **Feedback学習**:Day 1から👍👎ボタン搭載、3〜6ヶ月後に集計反映機構稼働

## 動作モード:CEO/AIエージェント

ユーザー(ファウンダー)から「CEOとして動いて」と指示済み。
- 自走範囲:質問文・解説文・コード・選曲案などの試作、低リスク微調整、次フェーズ自動着手
- 必ず確認:ブランドトーン変更/クライアント承認必要事項/外部公開/大規模破壊的変更

詳細は memory 内 `feedback_ceo_agent_mode.md` 参照。

---

## 残ファウンダー判断(着手前に確認)

[roadmap.md](./roadmap.md) と TaskList の `pending` を見ること。現時点で:
- **質問15問の文面レビュー**([questions.md](./questions.md))。気になる質問・選択肢の言い回しがあれば調整。OKならPhase 3着手

---

## ファイル更新のルール

- 重要な決定は **必ず [decisions.md](./decisions.md) に時系列で追記**(なぜ・どう変えたかも残す)
- アーキテクチャ変更は [roadmap.md](./roadmap.md) と [README.md](./README.md) の仕様表も同期
- 16タイプ/パロディ名/命名原則の変更は [types.md](./types.md) と memory の `project_love_types_16.md` 両方更新
- 大きな方針転換は memory にも書き込む(自動引き継ぎ対象になるため)
- **絵文字は使わない**(2026-05-20 ユーザー指摘:文字化け or 表示崩れの原因)

---

## 緊急時(状況不明になった場合)

1. このファイル → README.md → decisions.md の順に読む
2. それでも不明なら `git log` や `ls -la` でフォルダ状態を確認
3. ファウンダー(ユーザー)に状況確認のクエリを投げる
