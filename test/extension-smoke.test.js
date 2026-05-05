const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const tasks = JSON.parse(fs.readFileSync(path.join(root, ".vscode", "tasks.json"), "utf8"));

function testManifestCommands() {
  const activationCommands = new Set(
    manifest.activationEvents
      .filter((event) => event.startsWith("onCommand:"))
      .map((event) => event.slice("onCommand:".length))
  );
  const contributedCommands = new Set(
    manifest.contributes.commands.map((command) => command.command)
  );

  assert.deepEqual(activationCommands, contributedCommands);
}

function testRequiredTasksExist() {
  const labels = new Set(tasks.tasks.map((task) => task.label));

  assert.equal(labels.has("AI Loop: Project Test"), true);
  assert.equal(labels.has("AI Loop: Claude Review"), true);
  assert.equal(labels.has("AI Loop: Copilot Verify"), true);
}

function testScriptsExist() {
  assert.equal(typeof manifest.scripts["check:env"], "string");
  assert.equal(typeof manifest.scripts.compile, "string");
  assert.equal(typeof manifest.scripts["test:core"], "string");
  assert.equal(typeof manifest.scripts["test:smoke"], "string");
  assert.equal(fs.existsSync(path.join(root, "scripts", "check-env.js")), true);
  assert.equal(fs.existsSync(path.join(root, "scripts", "run-agent-task.js")), true);
}

testManifestCommands();
testRequiredTasksExist();
testScriptsExist();

console.log("extension smoke tests passed");
