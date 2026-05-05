const { spawnSync } = require("node:child_process");

const taskName = process.argv[2];
const envByTask = {
  "claude-review": "AI_LOOP_CLAUDE_REVIEW_COMMAND",
  "copilot-verify": "AI_LOOP_COPILOT_VERIFY_COMMAND"
};

const envName = envByTask[taskName];
if (!envName) {
  console.error("Usage: node scripts/run-agent-task.js claude-review|copilot-verify");
  process.exit(2);
}

const command = process.env[envName];
if (!command || !command.trim()) {
  console.error(`Set ${envName} to the command for this workspace.`);
  process.exit(1);
}

const result = spawnSync(command, {
  cwd: process.cwd(),
  env: process.env,
  shell: true,
  stdio: "inherit"
});

if (typeof result.status === "number") {
  process.exit(result.status);
}

if (result.error) {
  console.error(result.error.message);
}
process.exit(1);
