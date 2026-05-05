# AI Loop Orchestrator v1.1

> VS Code 上で **Codex / Claude Code / GitHub Copilot** を役割分担させ、  
> **実装 → 批評 → 修正 → 動作確認 → 収束判定** のループをファイルベースで回す、最小構成のオーケストレータです。

[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-blue)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-ES2022-3178c6)](#)
[![状態](https://img.shields.io/badge/status-v1.1-informational)](#)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

---

## 概要

`AI Loop Orchestrator` は、複数の AI コーディング支援ツールを **チャット履歴ではなくファイルを介して連携** させるための VS Code 拡張テンプレートです。

| 役割 | ツール | 担当 |
|---|---|---|
| 実装 | Codex | コード修正・生成 |
| 批評 | Claude Code | 仕様逸脱・バグ・エッジケースの指摘 |
| 確認 | GitHub Copilot | 動作確認・微修正提案 |

`.ai-loop/` 配下のファイルを共通インターフェースにすることで、次のことがやりやすくなります。

- 同じタスクを複数 AI に順番に渡す
- 指摘内容をラウンド単位で保存する
- 収束したのか、ループしているのかを判断する
- 最終レポートを残す

---

## 機能

- VS Code 拡張として動作
- `.ai-loop/state.json` による状態管理
- ラウンドごとのプロンプト・レビュー・判定ファイル生成
- Codex / Claude / Copilot の役割分担
- プロジェクト確認 task の終了結果を `verdict.json` に反映
- 同一指摘の検出による無限ループ防止
- 人間レビューへのエスカレーション（最大 6 ラウンド）
- `final_report.md` 生成

---

## リポジトリ構成

```text
ai-loop-orchestrator/
├─ README.md
├─ LICENSE
├─ package.json
├─ tsconfig.json
├─ .gitignore
├─ src/
│  ├─ core.ts          # 収束判定・テキスト解析の純粋ロジック
│  └─ extension.ts     # VS Code コマンド層
├─ .vscode/
│  ├─ launch.json
│  └─ tasks.json
├─ .ai-loop/
│  ├─ state.json       # ループ状態
│  ├─ spec.md          # 仕様（AI Loop: Start 後に編集）
│  ├─ agents/          # 各 AI の役割定義（カスタマイズ可）
│  │  ├─ codex.md
│  │  ├─ claude.md
│  │  └─ copilot.md
│  ├─ rounds/          # ラウンドごとの入出力ファイル
│  │  └─ 001/
│  │     ├─ codex_prompt.md
│  │     ├─ codex_result.md
│  │     ├─ claude_prompt.md
│  │     ├─ claude_review.md
│  │     ├─ copilot_prompt.md
│  │     ├─ copilot_verify.md
│  │     ├─ patch_summary.md
│  │     └─ verdict.json
│  └─ final/
│     ├─ final_report.md
│     └─ convergence.json
└─ docs/
   └─ images/
```

---

## クイックスタート

### 1. 依存関係をインストール

```bash
npm install
```

### 2. 拡張機能をコンパイル

VS Code のメニューから **Terminal → New Terminal** を選ぶか、`` Ctrl+` `` を押してターミナルを開き、以下を実行します。

```bash
npm run compile
```

`out/extension.js` が生成されれば成功です。

### 3. このリポジトリを VS Code で開く

### 4. `F5` を押す

`Run Extension` が起動し、**Extension Development Host** という別の VS Code ウィンドウが開きます。

> このプロジェクト自身にループを使いたい場合は、開いた新ウィンドウで  
> **File → Open Folder** から `ai-loop-orchestrator` フォルダを開いてください。

### 5. コマンドパレットを開く

新ウィンドウで `Ctrl+Shift+P` を押し、`AI Loop:` と入力するとコマンド一覧が表示されます。

### 6. 次の順番でコマンドを実行

```text
AI Loop: Start
  → spec.md を編集してゴールと完了条件を記述する  ← 必須
AI Loop: Run Codex
AI Loop: Run Claude Review
AI Loop: Run Copilot Verify
AI Loop: Run Project Tests
AI Loop: Next Round
AI Loop: Converge
```

---

## セットアップ

### 必要なもの

- VS Code
- Node.js / npm
- Codex CLI が使える環境（`codex exec --help` が通ること）
- Claude Code / GitHub Copilot を VS Code 上で利用できる環境

### 依存関係をインストール

```bash
npm install
```

### コンパイル

```bash
npm run compile
```

開発中は watch も使えます。

```bash
npm run watch
```

---

## 仕組み

この拡張は、AI 同士を直接会話させるのではなく、**ファイルを受け渡しの基盤**にします。

各ラウンドでは主に以下のファイルが使われます。

| ファイル | 役割 |
|---|---|
| `codex_prompt.md` | Codex への実装依頼（自動生成） |
| `codex_result.md` | Codex が書く変更要約 |
| `claude_prompt.md` | Claude Code へのレビュー依頼（自動生成） |
| `claude_review.md` | Claude が書くレビュー結果 |
| `copilot_prompt.md` | Copilot への確認依頼（自動生成） |
| `copilot_verify.md` | Copilot が書く確認結果 |
| `patch_summary.md` | ラウンド要約 |
| `verdict.json` | 判定状態 |

---

## コマンド

| コマンド | 内容 |
|---|---|
| `AI Loop: Start` | ループを初期化しラウンド 001 を作る |
| `AI Loop: Run Codex` | Codex に現在ラウンドの実装を依頼 |
| `AI Loop: Run Claude Review` | Claude Code にレビューを依頼 |
| `AI Loop: Run Copilot Verify` | Copilot に動作確認を依頼 |
| `AI Loop: Run Project Tests` | `AI Loop: Project Test` task を実行して `verdict.tests` を更新 |
| `AI Loop: Next Round` | 継続 / 収束 / 人間レビューを判定 |
| `AI Loop: Converge` | 最終レポートを生成 |
| `AI Loop: Open Current Round Files` | 現在ラウンドの主要ファイルを開く |

---

## 基本的な流れ

### 1. 開始

```text
AI Loop: Start
```

- `.ai-loop/` のテンプレートを準備
- `state.json` を初期化
- `spec.md` を作成
- ラウンド 001 を作成

**開始後すぐに `.ai-loop/spec.md` を編集してください。**  
`## Goal` にやりたいことを、`## Acceptance Criteria` に完了条件を書くと AI への指示が明確になります。

### 2. Codex で実装

```text
AI Loop: Run Codex
```

ターミナルに `codex exec` コマンドが送信されます。Codex が `codex_result.md` と `patch_summary.md` を埋めます。

### 3. Claude Code でレビュー

```text
AI Loop: Run Claude Review
```

`claude_prompt.md` が開くので、Claude Code に読ませて `claude_review.md` と `verdict.json` を更新させます。  
タスク `AI Loop: Claude Review` を設定すると自動化できます（後述）。

### 4. GitHub Copilot で確認

```text
AI Loop: Run Copilot Verify
```

`copilot_prompt.md` が開くので、Copilot に読ませて `copilot_verify.md` と `verdict.json` を更新させます。  
タスク `AI Loop: Copilot Verify` を設定すると自動化できます（後述）。

### 5. プロジェクト確認 task を実行

```text
AI Loop: Run Project Tests
```

### 6. 次のステップを判定

```text
AI Loop: Next Round
```

### 7. 最終レポートを生成

```text
AI Loop: Converge
```

---

## エージェント設定のカスタマイズ

`.ai-loop/agents/` 配下の Markdown ファイルが各 AI の役割定義です。  
`AI Loop: Start` 実行時にデフォルト内容で生成されます。プロジェクトに合わせて自由に編集できます。

| ファイル | カスタマイズ例 |
|---|---|
| `codex.md` | 命名規則、禁止ライブラリ、コーディング規約 |
| `claude.md` | レビュー観点の追加、厳しさ加減の調整 |
| `copilot.md` | ビルドコマンド、確認すべき実行パスの明示 |

---

## タスク自動化

`.vscode/tasks.json` に以下のタスクを追加することで、レビュー・確認ステップを自動化できます。

### Claude Review の自動化

```json
{
  "label": "AI Loop: Claude Review",
  "type": "shell",
  "command": "claude -p \"$(cat .ai-loop/rounds/${ROUND}/claude_prompt.md)\""
}
```

### Copilot Verify の自動化

```json
{
  "label": "AI Loop: Copilot Verify",
  "type": "shell",
  "command": "..."
}
```

### プロジェクトテストの設定

```json
{
  "label": "AI Loop: Project Test",
  "type": "shell",
  "command": "npm test"
}
```

`AI Loop: Run Project Tests` はこのタスクの終了コード (0 = PASS, 非0 = FAIL) を `verdict.json` に反映します。

---

## 収束ルール

以下をすべて満たした場合に「収束」と判定します。

- `tests === PASS`
- `claude === OK` または `NON_BLOCKER`
- `copilot === OK`

### 人間レビューに移行する条件

- 前ラウンドと同じ問題が繰り返された
- 最大ラウンド数（デフォルト: 6）に達した

---

## トラブルシューティング

### `F5` で起動しない

- `npm install` を実行したか
- `npm run compile` が成功しているか
- `.vscode/launch.json` があるか

### Codex が動かない

- `codex` コマンドが通るか
- `codex exec --help` が動くか

### `verdict.tests` が `UNKNOWN` のまま

- `.vscode/tasks.json` に `AI Loop: Project Test` があるか
- `AI Loop: Project Test` の `command` が、このプロジェクトで実行したい確認コマンドになっているか

### 同一指摘で止まる

それは無限ループ防止のための正常停止です。`final_report.md` を確認し、人間が方針修正してください。

---

## 開発メモ

このテンプレートは **最小構成** です。VS Code コマンド層は `src/extension.ts`、収束判定などの純粋ロジックは `src/core.ts` に分けています。今後、Webview ダッシュボード、差分の自動表示、CI 連携などに発展させやすい構成です。
