export type LoopStatus = "idle" | "codex" | "claude" | "copilot" | "done";

export type AgentId = "codex" | "claude" | "copilot";

export type AgentSelection = Record<AgentId, boolean>;

export type LoopState = {
  projectName: string;
  round: number;
  status: LoopStatus;
  maxRounds: number;
  converged: boolean;
  lastVerdict: string;
  requiresHumanReview: boolean;
  stopReason: string;
  agents: AgentSelection;
  updatedAt: string;
};

export type Verdict = {
  round: number;
  claude: "PENDING" | "BLOCKER" | "NON_BLOCKER" | "OK";
  copilot: "PENDING" | "NEEDS_FIX" | "OK";
  tests: "UNKNOWN" | "PASS" | "FAIL";
  sameIssuesAsPreviousRound: boolean;
  shouldContinue: boolean;
  requiresHumanReview: boolean;
  stopReason: string;
  reason: string[];
};

export function defaultState(projectName: string): LoopState {
  return {
    projectName,
    round: 1,
    status: "codex",
    maxRounds: 6,
    converged: false,
    lastVerdict: "PENDING",
    requiresHumanReview: false,
    stopReason: "",
    agents: defaultAgentSelection(),
    updatedAt: new Date().toISOString()
  };
}

export function defaultAgentSelection(): AgentSelection {
  return {
    codex: true,
    claude: true,
    copilot: true
  };
}

export function defaultVerdict(round: number): Verdict {
  return {
    round,
    claude: "PENDING",
    copilot: "PENDING",
    tests: "UNKNOWN",
    sameIssuesAsPreviousRound: false,
    shouldContinue: true,
    requiresHumanReview: false,
    stopReason: "",
    reason: []
  };
}

export function extractSection(markdown: string, heading: string): string {
  const lines = markdown.split(/\r?\n/);
  const startIndex = lines.findIndex(
    (line) => line.trim().toLowerCase() === heading.trim().toLowerCase()
  );

  if (startIndex === -1) {
    return "";
  }

  const collected: string[] = [];
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s+/.test(line)) {
      break;
    }
    collected.push(line);
  }

  return collected.join("\n").trim();
}

export function normalizeIssueText(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      const lowered = line.toLowerCase();
      return (
        line !== "" &&
        line !== "-" &&
        line !== "*" &&
        lowered !== "pending" &&
        lowered !== "none" &&
        lowered !== "n/a"
      );
    })
    .join("\n")
    .toLowerCase()
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function detectSameIssues(
  prevMarkdown: string,
  currentMarkdown: string,
  heading: string
): boolean {
  const prev = normalizeIssueText(extractSection(prevMarkdown, heading));
  const current = normalizeIssueText(extractSection(currentMarkdown, heading));

  if (!prev || !current) {
    return false;
  }

  return prev === current;
}

export function parseVerdictFromMarkdown(
  markdown: string,
  expected: readonly string[]
): string | null {
  const verdictSection = extractSection(markdown, "## Verdict");
  const normalized = verdictSection.toUpperCase();

  for (const v of expected) {
    const escaped = v.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const verdictPattern = new RegExp(`(^|[^A-Z_])${escaped}([^A-Z_]|$)`);
    if (verdictPattern.test(normalized)) {
      return v;
    }
  }

  return null;
}

export function pushUniqueReason(reasons: string[], message: string): string[] {
  if (!reasons.includes(message)) {
    reasons.push(message);
  }
  return reasons;
}

export function isConverged(
  verdict: Verdict,
  agents: AgentSelection = defaultAgentSelection()
): boolean {
  const claudeOk = !agents.claude || verdict.claude === "OK" || verdict.claude === "NON_BLOCKER";
  const copilotOk = !agents.copilot || verdict.copilot === "OK";

  return (
    verdict.tests === "PASS" &&
    claudeOk &&
    copilotOk
  );
}
