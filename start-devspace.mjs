import { spawnSync } from "node:child_process";
import { existsSync, openSync, writeSync } from "node:fs";
import net from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const cliPath = join(repoRoot, "dist", "cli.js");
const configPath = join(repoRoot, "dist", "config.js");
const stdoutPath = join(repoRoot, "devspace-named.stdout.log");
const stderrPath = join(repoRoot, "devspace-named.stderr.log");

if (!existsSync(cliPath) || !existsSync(configPath)) {
  console.error("DevSpace is not built. Run npm.cmd run build in the repository root first.");
  process.exit(1);
}

function findGitBash() {
  const explicit = process.env.DEVSPACE_GIT_BASH;
  if (explicit && existsSync(explicit)) return explicit;

  const whereGit = spawnSync("where.exe", ["git.exe"], {
    encoding: "utf8",
    windowsHide: true,
  });

  if (!whereGit.error && whereGit.status === 0) {
    for (const line of whereGit.stdout.split(/\r?\n/)) {
      const gitExe = line.trim();
      if (!gitExe) continue;
      const gitDir = dirname(gitExe);
      const gitRoot = dirname(gitDir);
      const candidates = [join(gitDir, "bash.exe"), join(gitRoot, "bin", "bash.exe")];
      const match = candidates.find((candidate) => existsSync(candidate));
      if (match) return match;
    }
  }

  const candidates = [
    process.env.ProgramFiles && join(process.env.ProgramFiles, "Git", "bin", "bash.exe"),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Programs", "Git", "bin", "bash.exe"),
    process.env["ProgramFiles(x86)"] && join(process.env["ProgramFiles(x86)"], "Git", "bin", "bash.exe"),
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate));
}

const bashPath = findGitBash();
if (bashPath) {
  process.env.PATH = `${dirname(bashPath)};${process.env.PATH ?? ""}`;
}

const { loadConfig } = await import(pathToFileURL(configPath).href);
const config = loadConfig();

function isListening() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: config.host, port: config.port });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(750);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });
}

if (await isListening()) {
  process.exit(0);
}

const stdoutFd = openSync(stdoutPath, "a");
const stderrFd = openSync(stderrPath, "a");

function makeLogWriter(fd) {
  return (chunk, encoding, callback) => {
    if (typeof encoding === "function") {
      callback = encoding;
      encoding = undefined;
    }
    const data = Buffer.isBuffer(chunk)
      ? chunk
      : ArrayBuffer.isView(chunk)
        ? Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)
        : Buffer.from(String(chunk), encoding || "utf8");
    writeSync(fd, data);
    if (typeof callback === "function") queueMicrotask(callback);
    return true;
  };
}

process.stdout.write = makeLogWriter(stdoutFd);
process.stderr.write = makeLogWriter(stderrFd);
process.env.DEVSPACE_TRUST_PROXY = "1";
process.argv = [process.execPath, cliPath, "serve"];

await import(pathToFileURL(cliPath).href);
