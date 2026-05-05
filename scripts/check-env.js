const { execFileSync } = require("node:child_process");

function requireCommand(command, args) {
  try {
    const output = execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
    console.log(`${command}: ${output.split(/\r?\n/)[0]}`);
  } catch (error) {
    console.error(`Missing required command: ${command}`);
    console.error("Install Node.js/npm and make sure both commands are available on PATH.");
    process.exitCode = 1;
  }
}

requireCommand("node", ["--version"]);
requireCommand("npm", ["--version"]);
