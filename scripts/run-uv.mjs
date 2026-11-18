import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const executableName = process.platform === "win32" ? "uv.exe" : "uv";
const configuredUv = process.env.UV_BIN;
const localCandidates = [
  configuredUv,
  path.join(homedir(), ".local", "bin", executableName),
  path.join(homedir(), ".cargo", "bin", executableName),
].filter(Boolean);

const uvCommand =
  localCandidates.find((candidate) => existsSync(candidate)) ?? "uv";
const child = spawn(uvCommand, process.argv.slice(2), {
  stdio: "inherit",
  shell: false,
});

child.on("error", (error) => {
  console.error(
    `Unable to start uv. Install uv or set UV_BIN to its executable path.\n${error.message}`,
  );
  process.exitCode = 1;
});

child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
