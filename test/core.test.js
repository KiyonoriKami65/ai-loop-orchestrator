const assert = require("node:assert/strict");
const {
  defaultVerdict,
  detectSameIssues,
  extractSection,
  isConverged,
  normalizeIssueText,
  parseVerdictFromMarkdown,
  pushUniqueReason
} = require("../out/core");

function testExtractSection() {
  const markdown = [
    "# Review",
    "",
    "## Verdict",
    "OK",
    "",
    "## Findings",
    "- all good"
  ].join("\n");

  assert.equal(extractSection(markdown, "## Verdict"), "OK");
  assert.equal(extractSection(markdown, "## Missing"), "");
}

function testNormalizeIssueText() {
  assert.equal(normalizeIssueText("\n- Fix A\t now\nNONE\n"), "- fix a now");
  assert.equal(normalizeIssueText("pending\nn/a\n*"), "");
}

function testDetectSameIssues() {
  const previous = [
    "# Claude Review",
    "## Required Fixes",
    "- Validate empty spec",
    "## Optional Improvements",
    "- later"
  ].join("\n");
  const current = [
    "# Claude Review",
    "## Required Fixes",
    "-   Validate empty spec",
    "## Optional Improvements",
    "- later"
  ].join("\n");

  assert.equal(detectSameIssues(previous, current, "## Required Fixes"), true);
  assert.equal(detectSameIssues(previous, "# Empty\n## Required Fixes\nnone", "## Required Fixes"), false);
}

function testParseVerdict() {
  assert.equal(
    parseVerdictFromMarkdown("# Review\n## Verdict\nNON_BLOCKER\n", [
      "BLOCKER",
      "NON_BLOCKER",
      "OK"
    ]),
    "NON_BLOCKER"
  );
  assert.equal(
    parseVerdictFromMarkdown("# Review\n## Verdict\nOK\n", ["NEEDS_FIX", "OK"]),
    "OK"
  );
}

function testReasonAndConvergence() {
  const reasons = [];
  pushUniqueReason(reasons, "passed");
  pushUniqueReason(reasons, "passed");
  assert.deepEqual(reasons, ["passed"]);

  const verdict = defaultVerdict(1);
  assert.equal(isConverged(verdict), false);
  verdict.tests = "PASS";
  verdict.claude = "NON_BLOCKER";
  verdict.copilot = "OK";
  assert.equal(isConverged(verdict), true);
}

testExtractSection();
testNormalizeIssueText();
testDetectSameIssues();
testParseVerdict();
testReasonAndConvergence();

console.log("core tests passed");
