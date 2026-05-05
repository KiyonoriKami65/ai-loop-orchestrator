import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import {
  LoopState,
  Verdict,
  defaultState,
  defaultVerdict,
  detectSameIssues,
  isConverged,
  parseVerdictFromMarkdown,
  pushUniqueReason
} from "./core";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("aiLoop.start", startLoop),
    vscode.commands.registerCommand("aiLoop.runCodex", runCodex),
    vscode.commands.registerCommand("aiLoop.runClaudeReview", runClaudeReview),
    vscode.commands.registerCommand("aiLoop.runCopilotVerify", runCopilotVerify),
    vscode.commands.registerCommand("aiLoop.runProjectTests", runProjectTests),
    vscode.commands.registerCommand("aiLoop.nextRound", nextRound),
    vscode.commands.registerCommand("aiLoop.converge", converge),
    vscode.commands.registerCommand("aiLoop.openCurrentRound", openCurrentRound)
  );
}

export function deactivate() {}

function workspaceRoot(): string {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    throw new Error("ワークスペースを開いてから実行してください。");
  }
  return folder.uri.fsPath;
}

function aiLoopRoot(): string {
  return path.join(workspaceRoot(), ".ai-loop");
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeText(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

function readText(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

function writeJson(filePath: string, data: unknown): void {
  writeText(filePath, JSON.stringify(data, null, 2));
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readText(filePath)) as T;
}

function exists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function stateFile(): string {
  return path.join(aiLoopRoot(), "state.json");
}

function specFile(): string {
  return path.join(aiLoopRoot(), "spec.md");
}

function agentFile(name: "codex" | "claude" | "copilot"): string {
  return path.join(aiLoopRoot(), "agents", `${name}.md`);
}

function roundDir(round: number): string {
  return path.join(aiLoopRoot(), "rounds", String(round).padStart(3, "0"));
}

function roundFile(round: number, name: string): string {
  return path.join(roundDir(round), name);
}

function currentRoundFile(name: string): string {
  const state = loadState();
  return roundFile(state.round, name);
}

function loadState(): LoopState {
  return readJson<LoopState>(stateFile());
}

function saveState(state: LoopState): void {
  state.updatedAt = new Date().toISOString();
  writeJson(stateFile(), state);
}

async function openFile(filePath: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(doc, { preview: false });
}

async function revealFiles(filePaths: string[]): Promise<void> {
  for (const filePath of filePaths) {
    await openFile(filePath);
  }
}

function ensureTemplateFiles(projectNameIfCreate = "sample-project"): void {
  ensureDir(aiLoopRoot());
  ensureDir(path.join(aiLoopRoot(), "agents"));
  ensureDir(path.join(aiLoopRoot(), "rounds"));
  ensureDir(path.join(aiLoopRoot(), "final"));

  if (!exists(specFile())) {
    writeText(
      specFile(),
      `# Spec

## Project
${projectNameIfCreate}

## Goal
ここに今回の実装対象・制約・完了条件を書いてください。

## Acceptance Criteria
- 仕様を満たす
- テストが通る
- Claude review が BLOCKER でない
- Copilot verify が OK になる
`
    );
  }

  if (!exists(stateFile())) {
    writeJson(stateFile(), defaultState(projectNameIfCreate));
  }

  if (!exists(agentFile("codex"))) {
    writeText(agentFile("codex"), codexRoleTemplate());
  }
  if (!exists(agentFile("claude"))) {
    writeText(agentFile("claude"), claudeRoleTemplate());
  }
  if (!exists(agentFile("copilot"))) {
    writeText(agentFile("copilot"), copilotRoleTemplate());
  }
}

function ensureRoundFiles(round: number): void {
  const dir = roundDir(round);
  ensureDir(dir);

  const codexPromptPath = roundFile(round, "codex_prompt.md");
  const codexResultPath = roundFile(round, "codex_result.md");
  const claudePromptPath = roundFile(round, "claude_prompt.md");
  const claudeReviewPath = roundFile(round, "claude_review.md");
  const copilotPromptPath = roundFile(round, "copilot_prompt.md");
  const copilotVerifyPath = roundFile(round, "copilot_verify.md");
  const verdictPath = roundFile(round, "verdict.json");
  const patchSummaryPath = roundFile(round, "patch_summary.md");

  writeText(codexPromptPath, buildCodexPrompt(round));
  writeText(claudePromptPath, buildClaudePrompt(round));
  writeText(copilotPromptPath, buildCopilotPrompt(round));

  if (!exists(codexResultPath)) {
    writeText(
      codexResultPath,
      `# Codex Result

## Summary

## Changed Files

## Test Notes

## Remaining Issues
`
    );
  }

  if (!exists(claudeReviewPath)) {
    writeText(
      claudeReviewPath,
      `# Claude Review

## Verdict
PENDING

## Required Fixes

## Optional Improvements

## Findings
`
    );
  }

  if (!exists(copilotVerifyPath)) {
    writeText(
      copilotVerifyPath,
      `# Copilot Verify

## Verdict
PENDING

## Build / Run Check
NOT_RUN

## Findings

## Micro Fix Suggestions
`
    );
  }

  if (!exists(verdictPath)) {
    writeJson(verdictPath, defaultVerdict(round));
  }

  if (!exists(patchSummaryPath)) {
    writeText(
      patchSummaryPath,
      `# Patch Summary

## Fixed This Round

## Deferred To Next Round
`
    );
  }
}

function codexRoleTemplate(): string {
  return `# Codex Role

あなたは実装担当です。

優先順位:
1. spec.md を満たす
2. Claude review の Required Fixes を反映する
3. Copilot verify の Micro Fix Suggestions を反映する
4. テストを壊さない
5. 変更内容を codex_result.md に記録する

出力ルール:
- 変更した理由を書く
- 未解決点があれば明記する
- 指摘されていない大規模変更はしない
- 勝手なリファクタはしない
`;
}

function claudeRoleTemplate(): string {
  return `# Claude Role

あなたは厳しめの批評担当です。

観点:
1. 仕様逸脱
2. バグ可能性
3. エッジケース
4. テスト不足
5. リファクタ余地
6. 今回必須か後回しでよいかの分離

判定:
- BLOCKER
- NON_BLOCKER
- OK

ルール:
- Required Fixes が空なら OK または NON_BLOCKER
- Required Fixes があるなら BLOCKER
- 必ず git diff を見る

出力先:
- 各ラウンドの claude_review.md
- verdict.json の claude / reason を更新
`;
}

function copilotRoleTemplate(): string {
  return `# Copilot Role

あなたは動作確認・微修正担当です。

観点:
1. 実運用で壊れそうな点
2. DX / UX の違和感
3. 軽微修正で済む改善
4. Build / Run の見込み

判定:
- NEEDS_FIX
- OK

ルール:
- 可能ならビルド確認
- 主要な実行パスを確認
- 大規模修正は禁止

出力先:
- 各ラウンドの copilot_verify.md
- verdict.json の copilot / reason を更新
`;
}

function buildCodexPrompt(round: number): string {
  const roundStr = String(round).padStart(3, "0");
  const prev = round > 1 ? String(round - 1).padStart(3, "0") : null;

  const readSection = prev
    ? `- .ai-loop/rounds/${prev}/claude_review.md\n- .ai-loop/rounds/${prev}/copilot_verify.md\n- .ai-loop/rounds/${prev}/verdict.json`
    : "";
  const fixTarget = prev
    ? `- .ai-loop/rounds/${prev}/claude_review.md の "## Required Fixes"\n- .ai-loop/rounds/${prev}/copilot_verify.md の "## Micro Fix Suggestions"`
    : "- 初回ラウンドでは spec.md の要求";

  return `# Codex Prompt

あなたは実装担当です。

読むもの:
- .ai-loop/spec.md
- .ai-loop/agents/codex.md
${readSection}

# FIX TARGET

必ず修正するもの:
${fixTarget}

やってはいけない:
- 指摘以外の変更
- 勝手なリファクタ
- 仕様の拡張
- 無関係な命名変更
- レビュー対象外の大規模修正

やること:
1. 必要なコード修正を行う
2. 必要なテストを追加・修正する
3. 実施内容を .ai-loop/rounds/${roundStr}/codex_result.md に書く
4. 要点を .ai-loop/rounds/${roundStr}/patch_summary.md に書く
5. 未解決点があれば codex_result.md に明記する

注意:
- 直近レビューの必須修正を最優先
- 収束したと思っても根拠を書く
`;
}

function buildClaudePrompt(round: number): string {
  const roundStr = String(round).padStart(3, "0");
  return `# Claude Review Prompt

あなたは批評担当です。

必ず git diff を確認すること。
レビューは今回ラウンドの変更差分を中心に行うこと。

読むもの:
- .ai-loop/spec.md
- .ai-loop/agents/claude.md
- .ai-loop/rounds/${roundStr}/codex_result.md
- git diff
- 必要なら関連ファイル一式

出力先:
- .ai-loop/rounds/${roundStr}/claude_review.md
- .ai-loop/rounds/${roundStr}/verdict.json の claude / reason

出力形式:

# Claude Review

## Verdict
BLOCKER | NON_BLOCKER | OK

## Required Fixes
- ...

## Optional Improvements
- ...

## Findings
- ...

判定ルール:
- Required Fixes が空なら OK または NON_BLOCKER
- Required Fixes があるなら BLOCKER
`;
}

function buildCopilotPrompt(round: number): string {
  const roundStr = String(round).padStart(3, "0");
  return `# Copilot Verify Prompt

あなたは動作確認担当です。

読むもの:
- .ai-loop/spec.md
- .ai-loop/agents/copilot.md
- .ai-loop/rounds/${roundStr}/codex_result.md
- .ai-loop/rounds/${roundStr}/claude_review.md
- 必要ならコードベース全体

必ずやること:
- 可能ならビルド確認
- 主要な実行パスの確認
- 実運用で壊れそうなケースの指摘

禁止:
- 大規模修正提案
- 仕様変更提案
- 全面リファクタ提案

出力先:
- .ai-loop/rounds/${roundStr}/copilot_verify.md
- .ai-loop/rounds/${roundStr}/verdict.json の copilot / reason

出力形式:

# Copilot Verify

## Verdict
NEEDS_FIX | OK

## Build / Run Check
- PASS | FAIL | NOT_RUN

## Findings
- ...

## Micro Fix Suggestions
- ...
`;
}

function buildFinalReport(state: LoopState): string {
  let out = `# Final Report

- project: ${state.projectName}
- round: ${state.round}
- status: ${state.status}
- converged: ${state.converged}
- requiresHumanReview: ${state.requiresHumanReview}
- lastVerdict: ${state.lastVerdict}
- stopReason: ${state.stopReason}

`;

  for (let i = 1; i <= state.round; i++) {
    const r = String(i).padStart(3, "0");
    out += `## Round ${r}

`;

    const files = [
      `rounds/${r}/codex_result.md`,
      `rounds/${r}/claude_review.md`,
      `rounds/${r}/copilot_verify.md`,
      `rounds/${r}/patch_summary.md`,
      `rounds/${r}/verdict.json`
    ];

    for (const rel of files) {
      const abs = path.join(aiLoopRoot(), rel);
      if (exists(abs)) {
        out += `### ${rel}

`;
        out += readText(abs);
        out += `

`;
      }
    }
  }

  return out;
}

function updateVerdictFromFiles(round: number): Verdict {
  const verdictPath = roundFile(round, "verdict.json");
  const verdict = exists(verdictPath) ? readJson<Verdict>(verdictPath) : defaultVerdict(round);

  verdict.requiresHumanReview = false;
  verdict.stopReason = "";

  const claudeReview = exists(roundFile(round, "claude_review.md"))
    ? readText(roundFile(round, "claude_review.md"))
    : "";

  const copilotVerify = exists(roundFile(round, "copilot_verify.md"))
    ? readText(roundFile(round, "copilot_verify.md"))
    : "";

  const claudeVerdict = parseVerdictFromMarkdown(claudeReview, ["BLOCKER", "NON_BLOCKER", "OK"]);
  const copilotVerdict = parseVerdictFromMarkdown(copilotVerify, ["NEEDS_FIX", "OK"]);

  if (claudeVerdict) {
    verdict.claude = claudeVerdict as Verdict["claude"];
  }

  if (copilotVerdict) {
    verdict.copilot = copilotVerdict as Verdict["copilot"];
  }

  if (round > 1) {
    const prevClaude = exists(roundFile(round - 1, "claude_review.md"))
      ? readText(roundFile(round - 1, "claude_review.md"))
      : "";

    const prevCopilot = exists(roundFile(round - 1, "copilot_verify.md"))
      ? readText(roundFile(round - 1, "copilot_verify.md"))
      : "";

    const sameClaudeRequired = detectSameIssues(prevClaude, claudeReview, "## Required Fixes");
    const sameCopilotMicro = detectSameIssues(prevCopilot, copilotVerify, "## Micro Fix Suggestions");

    verdict.sameIssuesAsPreviousRound = sameClaudeRequired || sameCopilotMicro;
  } else {
    verdict.sameIssuesAsPreviousRound = false;
  }

  verdict.shouldContinue = !isConverged(verdict);

  if (verdict.sameIssuesAsPreviousRound) {
    verdict.shouldContinue = false;
    verdict.requiresHumanReview = true;
    verdict.stopReason = "Same issues repeated";
    verdict.reason = pushUniqueReason(
      verdict.reason,
      "Same issues repeated → forcing human review"
    );
  }

  writeJson(verdictPath, verdict);
  return verdict;
}

async function executeTaskByNameWaitExit(taskName: string): Promise<number | undefined> {
  const tasks = await vscode.tasks.fetchTasks();
  const task = tasks.find((t) => t.name === taskName);

  if (!task) {
    return undefined;
  }

  return new Promise<number | undefined>(async (resolve, reject) => {
    let finished = false;

    const endProcessDisposable = vscode.tasks.onDidEndTaskProcess((event) => {
      if (event.execution.task.name === taskName && !finished) {
        finished = true;
        cleanup();
        resolve(event.exitCode);
      }
    });

    const endTaskDisposable = vscode.tasks.onDidEndTask((event) => {
      if (event.execution.task.name === taskName && !finished) {
        setTimeout(() => {
          if (!finished) {
            finished = true;
            cleanup();
            resolve(undefined);
          }
        }, 0);
      }
    });

    const cleanup = () => {
      endProcessDisposable.dispose();
      endTaskDisposable.dispose();
    };

    try {
      await vscode.tasks.executeTask(task);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

async function runOptionalTaskAndRefreshVerdict(
  taskName: string,
  round: number
): Promise<boolean> {
  const tasks = await vscode.tasks.fetchTasks();
  if (!tasks.some((t) => t.name === taskName)) {
    return false;
  }

  const exitCode = await executeTaskByNameWaitExit(taskName);
  const verdict = updateVerdictFromFiles(round);
  await openFile(roundFile(round, "verdict.json"));

  if (exitCode === 0) {
    vscode.window.showInformationMessage(
      `${taskName} が成功しました。verdict を ${verdict.shouldContinue ? "継続" : "停止"} 判定に更新しました。`
    );
  } else if (typeof exitCode === "number") {
    vscode.window.showWarningMessage(`${taskName} が失敗しました。出力を確認してください。`);
  } else {
    vscode.window.showWarningMessage(`${taskName} の終了コードを取得できませんでした。`);
  }

  return true;
}

async function startLoop(): Promise<void> {
  try {
    const projectName = await vscode.window.showInputBox({
      prompt: "AI Loop の対象名",
      placeHolder: "example-feature"
    });

    if (!projectName) {
      return;
    }

    ensureTemplateFiles(projectName);

    const spec = await vscode.window.showInputBox({
      prompt: "今回の仕様を1行で入力してください",
      placeHolder: "例: ログイン API の例外処理を強化しテストを追加"
    });

    const state = defaultState(projectName);
    saveState(state);

    if (spec && spec.trim()) {
      writeText(
        specFile(),
        `# Spec

## Project
${projectName}

## Goal
${spec.trim()}

## Acceptance Criteria
- 仕様を満たす
- テストが通る
- Claude review が BLOCKER でない
- Copilot verify が OK になる
`
      );
    }

    ensureRoundFiles(1);

    await revealFiles([
      specFile(),
      roundFile(1, "codex_prompt.md"),
      roundFile(1, "verdict.json")
    ]);

    vscode.window.showInformationMessage(
      "AI Loop を開始しました。次は「AI Loop: Run Codex」を実行してください。"
    );
  } catch (error) {
    showError(error);
  }
}

async function runCodex(): Promise<void> {
  try {
    const state = loadState();
    state.status = "codex";
    saveState(state);

    ensureRoundFiles(state.round);

    const roundStr = String(state.round).padStart(3, "0");
    const promptPath = roundFile(state.round, "codex_prompt.md");

    await revealFiles([
      promptPath,
      roundFile(state.round, "codex_result.md"),
      roundFile(state.round, "patch_summary.md"),
      roundFile(state.round, "verdict.json")
    ]);

    const terminal = vscode.window.createTerminal("AI Loop Codex");
    terminal.show();
    terminal.sendText(
      `codex exec "Read .ai-loop/spec.md and .ai-loop/rounds/${roundStr}/codex_prompt.md. Only fix issues described in the previous review. Do not refactor unrelated parts. Write results to .ai-loop/rounds/${roundStr}/codex_result.md and .ai-loop/rounds/${roundStr}/patch_summary.md."`
    );

    vscode.window.showInformationMessage(
      `Codex 実行を開始しました。Round ${roundStr} の codex_result.md を確認してください。`
    );
  } catch (error) {
    showError(error);
  }
}

async function runClaudeReview(): Promise<void> {
  try {
    const state = loadState();
    state.status = "claude";
    saveState(state);

    ensureRoundFiles(state.round);

    await revealFiles([
      roundFile(state.round, "claude_prompt.md"),
      roundFile(state.round, "claude_review.md"),
      roundFile(state.round, "verdict.json")
    ]);

    const terminal = vscode.window.createTerminal("AI Loop Git Diff");
    terminal.show();
    terminal.sendText("git diff");

    const automated = await runOptionalTaskAndRefreshVerdict(
      "AI Loop: Claude Review",
      state.round
    );

    if (!automated) {
      vscode.window.showInformationMessage(
        "Claude Code に claude_prompt.md を読ませて、claude_review.md と verdict.json を更新してください。自動化する場合は task `AI Loop: Claude Review` を追加してください。"
      );
    }
  } catch (error) {
    showError(error);
  }
}

async function runCopilotVerify(): Promise<void> {
  try {
    const state = loadState();
    state.status = "copilot";
    saveState(state);

    ensureRoundFiles(state.round);

    await revealFiles([
      roundFile(state.round, "copilot_prompt.md"),
      roundFile(state.round, "copilot_verify.md"),
      roundFile(state.round, "verdict.json")
    ]);

    const automated = await runOptionalTaskAndRefreshVerdict(
      "AI Loop: Copilot Verify",
      state.round
    );

    if (!automated) {
      vscode.window.showInformationMessage(
        "Copilot に copilot_prompt.md を読ませて、copilot_verify.md と verdict.json を更新してください。自動化する場合は task `AI Loop: Copilot Verify` を追加してください。"
      );
    }
  } catch (error) {
    showError(error);
  }
}

async function runProjectTests(): Promise<void> {
  try {
    const state = loadState();
    ensureRoundFiles(state.round);

    const verdictPath = roundFile(state.round, "verdict.json");
    const verdict = exists(verdictPath)
      ? readJson<Verdict>(verdictPath)
      : defaultVerdict(state.round);

    const exitCode = await executeTaskByNameWaitExit("AI Loop: Project Test");

    if (exitCode === 0) {
      verdict.tests = "PASS";
      verdict.reason = pushUniqueReason(verdict.reason, "Project test task passed");
      writeJson(verdictPath, verdict);
      await openFile(verdictPath);
      vscode.window.showInformationMessage("テスト成功: verdict.tests = PASS に更新しました。");
      return;
    }

    if (typeof exitCode === "number") {
      verdict.tests = "FAIL";
      verdict.reason = pushUniqueReason(verdict.reason, "Project test task failed");
      writeJson(verdictPath, verdict);
      await openFile(verdictPath);
      vscode.window.showWarningMessage("テスト失敗: verdict.tests = FAIL に更新しました。");
      return;
    }

    verdict.tests = "UNKNOWN";
    verdict.reason = pushUniqueReason(
      verdict.reason,
      "Project test task not found or exit code unavailable"
    );
    writeJson(verdictPath, verdict);
    await openFile(verdictPath);

    vscode.window.showWarningMessage(
      "テスト task が見つからないか、終了コードを取得できませんでした。.vscode/tasks.json を調整してください。"
    );
  } catch (error) {
    showError(error);
  }
}

async function nextRound(): Promise<void> {
  try {
    const state = loadState();
    const currentVerdict = updateVerdictFromFiles(state.round);

    if (currentVerdict.requiresHumanReview) {
      state.status = "done";
      state.converged = false;
      state.requiresHumanReview = true;
      state.lastVerdict = "HUMAN_REVIEW_REQUIRED";
      state.stopReason = currentVerdict.stopReason || "Human review required";
      saveState(state);

      vscode.window.showWarningMessage(
        "同じ問題が継続したため、人間レビューにエスカレーションしました。"
      );
      return;
    }

    if (!currentVerdict.shouldContinue) {
      state.status = "done";
      state.converged = true;
      state.requiresHumanReview = false;
      state.lastVerdict = "CONVERGED";
      state.stopReason = "";
      saveState(state);

      vscode.window.showInformationMessage(
        "収束条件を満たしました。AI Loop: Converge を実行してください。"
      );
      return;
    }

    if (state.round >= state.maxRounds) {
      state.status = "done";
      state.converged = false;
      state.requiresHumanReview = true;
      state.lastVerdict = "MAX_ROUNDS_REACHED";
      state.stopReason = "Max rounds reached";
      saveState(state);

      vscode.window.showWarningMessage(
        "最大ラウンドに達しました。人間レビューを推奨します。"
      );
      return;
    }

    state.round += 1;
    state.status = "codex";
    state.lastVerdict = "CONTINUE";
    state.requiresHumanReview = false;
    state.stopReason = "";
    saveState(state);

    ensureRoundFiles(state.round);

    await revealFiles([
      roundFile(state.round, "codex_prompt.md"),
      roundFile(state.round, "verdict.json")
    ]);

    vscode.window.showInformationMessage(
      `Round ${String(state.round).padStart(3, "0")} を開始しました。`
    );
  } catch (error) {
    showError(error);
  }
}

async function converge(): Promise<void> {
  try {
    const state = loadState();
    const finalDir = path.join(aiLoopRoot(), "final");
    ensureDir(finalDir);

    const reportPath = path.join(finalDir, "final_report.md");
    const convergencePath = path.join(finalDir, "convergence.json");

    const report = buildFinalReport(state);
    writeText(reportPath, report);

    writeJson(convergencePath, {
      projectName: state.projectName,
      round: state.round,
      converged: state.converged,
      requiresHumanReview: state.requiresHumanReview,
      lastVerdict: state.lastVerdict,
      stopReason: state.stopReason,
      updatedAt: new Date().toISOString()
    });

    await revealFiles([reportPath, convergencePath]);

    vscode.window.showInformationMessage("Final report を生成しました。");
  } catch (error) {
    showError(error);
  }
}

async function openCurrentRound(): Promise<void> {
  try {
    const state = loadState();
    ensureRoundFiles(state.round);

    await revealFiles([
      currentRoundFile("codex_prompt.md"),
      currentRoundFile("codex_result.md"),
      currentRoundFile("claude_review.md"),
      currentRoundFile("copilot_verify.md"),
      currentRoundFile("verdict.json")
    ]);
  } catch (error) {
    showError(error);
  }
}

function showError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  void vscode.window.showErrorMessage(message);
}
