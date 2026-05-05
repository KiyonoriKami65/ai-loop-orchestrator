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

## 機能

- VS Code 拡張として動作
- `.ai-loop/state.json` による状態管理
- ラウンドごとのプロンプト・レビュー・判定ファイル生成
- Codex / Claude / Copilot の役割分担
- テスト結果を `verdict.json` に反映
- 同一指摘の検出による無限ループ防止
- 人間レビューへのエスカレーション
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
│  ├─ core.ts
│  └─ extension.ts
├─ .vscode/
│  ├─ launch.json
│  └─ tasks.json
├─ .ai-loop/
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

## クイックスタート

### 1. 依存関係をインストール

```bash
npm install
```

### 2. 拡張機能をコンパイル

```bash
npm run compile
```

### 3. このリポジトリを VS Code で開く

### 4. `F5` を押す

`Run Extension` が起動し、拡張機能の開発用 VS Code ウィンドウが開きます。

### 5. 次の順番でコマンドを実行

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

## セットアップ

### 必要なもの

- VS Code
- Node.js / npm
- Codex CLI が使える環境
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

- `codex_prompt.md`: Codex への実装依頼
- `codex_result.md`: Codex の変更要約
- `claude_review.md`: Claude のレビュー
- `copilot_verify.md`: Copilot の確認結果
- `patch_summary.md`: ラウンド要約
- `verdict.json`: 判定状態

---

## コマンド

| コマンド | 内容 |
|---|---|
| `AI Loop: Start` | ループを初期化しラウンド 001 を作る |
| `AI Loop: Run Codex` | Codex に現在ラウンドの実装を依頼 |
| `AI Loop: Run Claude Review` | Claude Code にレビューを依頼 |
| `AI Loop: Run Copilot Verify` | Copilot に動作確認を依頼 |
| `AI Loop: Run Project Tests` | テストを実行して `verdict.tests` を更新 |
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

### 2. Codex で実装

```text
AI Loop: Run Codex
```

### 3. Claude Code でレビュー

```text
AI Loop: Run Claude Review
```

### 4. GitHub Copilot で確認

```text
AI Loop: Run Copilot Verify
```

### 5. テストを実行

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

## 収束ルール

以下をすべて満たした場合に「収束」と判定します。

- `tests === PASS`
- `claude === OK` または `NON_BLOCKER`
- `copilot === OK`

### 人間レビューに移行する条件

- 前ラウンドと同じ問題が繰り返された
- 最大ラウンド数に達した

---

## トラブルシューティング

### `F5` で起動しない

- `npm install` を実行したか
- `npm run compile` が成功しているか
- `.vscode/launch.json` があるか

### Codex が動かない

- `codex` コマンドが通るか
- `codex exec --help` が動くか

### テストが `UNKNOWN` のまま

- `.vscode/tasks.json` に `AI Loop: Project Test` があるか
- `command` が正しいか

### 同一指摘で止まる

それは無限ループ防止のための正常停止です。`final_report.md` を確認し、人間が方針修正してください。

---

## 開発メモ

このテンプレートは **最小構成** です。VS Code コマンド層は `src/extension.ts`、収束判定などの純粋ロジックは `src/core.ts` に分けています。今後、Webview ダッシュボード、差分の自動表示、CI 連携などに発展させやすい構成です。
