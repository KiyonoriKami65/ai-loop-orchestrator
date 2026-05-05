# AI Loop Orchestrator v1.1

> VS Code 上で **Codex / Claude Code / GitHub Copilot** を役割分担させ、  
> **実装 → 批評 → 修正 → 動作確認 → 収束判定** のループをファイルベースで回す、最小構成のオーケストレータです。

[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-blue)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-ES2022-3178c6)](#)
[![Status](https://img.shields.io/badge/status-v1.1-informational)](#)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

---

## Overview

`AI Loop Orchestrator` は、複数の AI コーディング支援ツールを **チャット履歴ではなくファイルを介して連携** させるための VS Code 拡張テンプレートです。

このテンプレートでは、以下の役割分担を前提にしています。

- **Codex**: 実装担当
- **Claude Code**: 厳しめのレビュー担当
- **GitHub Copilot**: 動作確認・軽微修正担当

`.ai-loop/` 配下のファイルを共通インターフェースにすることで、次のことがやりやすくなります。

- 同じタスクを複数 AI に順番に渡す
- 指摘内容をラウンド単位で保存する
- 収束したのか、ループしているのかを判断する
- 最終レポートを残す

---

## Features

- VS Code 拡張として動作
- `.ai-loop/state.json` による状態管理
- ラウンドごとのプロンプト・レビュー・判定ファイル生成
- Codex / Claude / Copilot の役割分担
- テスト結果を `verdict.json` に反映
- same issues 検出による無限ループ防止
- Human Review へのエスカレーション
- `final_report.md` 生成

---

## Repository Structure

```text
ai-loop-orchestrator/
├─ README.md
├─ LICENSE
├─ CONTRIBUTING.md
├─ CODE_OF_CONDUCT.md
├─ SECURITY.md
├─ package.json
├─ tsconfig.json
├─ .gitignore
├─ src/
│  ├─ core.ts
│  └─ extension.ts
├─ test/
│  └─ core.test.js
├─ .vscode/
│  ├─ launch.json
│  └─ tasks.json
├─ .ai-loop/
│  ├─ spec.md
│  ├─ state.json
│  ├─ agents/
│  │  ├─ codex.md
│  │  ├─ claude.md
│  │  └─ copilot.md
│  ├─ rounds/
│  │  └─ .gitkeep
│  └─ final/
│     └─ .gitkeep
└─ docs/
   └─ images/
      └─ .gitkeep
```

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Compile the extension

```bash
npm run compile
```

### 3. Run tests

```bash
npm test
```

### 4. Open this repository in VS Code

### 5. Press `F5`

`Run Extension` が起動し、Extension Development Host が開きます。

### 6. Run commands in this order

```text
AI Loop: Start
AI Loop: Run Codex
AI Loop: Run Claude Review
AI Loop: Run Copilot Verify
AI Loop: Run Project Tests
AI Loop: Next Round
AI Loop: Converge
```

---

## Setup

### Requirements

- VS Code
- Node.js / npm
- Codex CLI が使える環境
- Claude Code / GitHub Copilot を VS Code 上で利用できる環境

### Install dependencies

```bash
npm install
```

### Compile

```bash
npm run compile
```

### Test

```bash
npm test
```

`npm test` は TypeScript compile 後に、収束判定・verdict parser・same issues 検出などのコアロジックを検証します。

開発中は watch も使えます。

```bash
npm run watch
```

---

## How It Works

この拡張は、AI 同士を直接会話させるのではなく、**ファイルを受け渡しの基盤**にします。

各ラウンドでは主に以下のファイルが使われます。

- `codex_prompt.md`: Codex への実装依頼
- `codex_result.md`: Codex の変更要約
- `claude_review.md`: Claude のレビュー
- `copilot_verify.md`: Copilot の確認結果
- `patch_summary.md`: ラウンド要約
- `verdict.json`: 判定状態

---

## Commands

| Command | Meaning |
|---|---|
| `AI Loop: Start` | ループを初期化し Round 001 を作る |
| `AI Loop: Run Codex` | Codex に現在ラウンドの実装を依頼 |
| `AI Loop: Run Claude Review` | Claude Code にレビューを依頼。任意 task `AI Loop: Claude Review` があれば実行 |
| `AI Loop: Run Copilot Verify` | Copilot に動作確認を依頼。任意 task `AI Loop: Copilot Verify` があれば実行 |
| `AI Loop: Run Project Tests` | テストを実行して `verdict.tests` を更新 |
| `AI Loop: Next Round` | 継続 / 収束 / Human Review を判定 |
| `AI Loop: Converge` | Final Report を生成 |
| `AI Loop: Open Current Round Files` | 現在ラウンドの主要ファイルを開く |

---

## Typical Workflow

### 1. Start

```text
AI Loop: Start
```

- `.ai-loop/` のテンプレートを準備
- `state.json` を初期化
- `spec.md` を作成 / 更新
- Round 001 を作成

### 2. Implement with Codex

```text
AI Loop: Run Codex
```

### 3. Review with Claude Code

```text
AI Loop: Run Claude Review
```

### 4. Verify with GitHub Copilot

```text
AI Loop: Run Copilot Verify
```

### 5. Run Tests

```text
AI Loop: Run Project Tests
```

### 6. Decide Next Step

```text
AI Loop: Next Round
```

### 7. Generate Final Report

```text
AI Loop: Converge
```

---

## Convergence Rules

以下をすべて満たした場合に「収束」と判定します。

- `tests === PASS`
- `claude === OK` または `NON_BLOCKER`
- `copilot === OK`

### Human Review に移行する条件

- 前ラウンドと同じ問題が繰り返された
- 最大ラウンド数に達した

---

## Troubleshooting

### `F5` で起動しない

- `npm install` を実行したか
- `npm run compile` が成功しているか
- `.vscode/launch.json` があるか

### Codex が動かない

- `codex` コマンドが通るか
- `codex exec --help` が動くか

### Claude / Copilot を自動実行したい

`.vscode/tasks.json` に以下の名前の task を追加すると、各 command 実行時に自動で起動します。

- `AI Loop: Claude Review`
- `AI Loop: Copilot Verify`

task が存在しない場合は、従来通り prompt / review / verdict ファイルを開いて手動更新を促します。

### テストが `UNKNOWN` のまま

- `.vscode/tasks.json` に `AI Loop: Project Test` があるか
- `command` が正しいか

### same issues で止まる

それは無限ループ防止のための正常停止です。`final_report.md` を確認し、人間が方針修正してください。

---

## Development Notes

このテンプレートは **最小構成** です。VS Code command 層は `src/extension.ts`、収束判定などの純粋ロジックは `src/core.ts` に分けています。今後、Webview Dashboard、diff 自動表示、CI 連携などに発展させやすい構成です。
