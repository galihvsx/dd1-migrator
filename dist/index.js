#!/usr/bin/env node

// src/index.ts
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
var CWD = process.cwd();
async function select(message, options) {
  let cursor = 0;
  const render = () => {
    process.stdout.write(`\x1B[${options.length + 1}A`);
    process.stdout.write(`\x1B[36m?\x1B[0m ${message}
`);
    for (let i = 0; i < options.length; i++) {
      const prefix = i === cursor ? "\x1B[36m\u276F\x1B[0m" : " ";
      const text = i === cursor ? `\x1B[36m${options[i].label}\x1B[0m` : `\x1B[2m${options[i].label}\x1B[0m`;
      process.stdout.write(`\x1B[2K${prefix} ${text}
`);
    }
  };
  process.stdout.write("\n".repeat(options.length + 1));
  render();
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  return new Promise((resolve) => {
    const onData = (key) => {
      if (key === "\x1B[A") {
        cursor = (cursor - 1 + options.length) % options.length;
        render();
      } else if (key === "\x1B[B") {
        cursor = (cursor + 1) % options.length;
        render();
      } else if (key === "\r" || key === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onData);
        resolve(options[cursor].value);
      } else if (key === "") {
        process.stdout.write("\n");
        process.exit(0);
      }
    };
    process.stdin.on("data", onData);
  });
}
async function textInput(message) {
  process.stdout.write(`\x1B[36m?\x1B[0m ${message} `);
  process.stdin.setRawMode(false);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  return new Promise((resolve) => {
    const onData = (data) => {
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      resolve(data.trim());
    };
    process.stdin.on("data", onData);
  });
}
function findWranglerConfig() {
  for (const name of ["wrangler.jsonc", "wrangler.json"]) {
    try {
      const path = join(CWD, name);
      readFileSync(path);
      return path;
    } catch {
    }
  }
  return null;
}
function getD1Bindings() {
  const configPath = findWranglerConfig();
  if (!configPath) return [];
  try {
    const raw = readFileSync(configPath, "utf8");
    const stripped = raw.replace(/\/\/.*$/gm, "");
    const config = JSON.parse(stripped);
    return Array.isArray(config.d1_databases) ? config.d1_databases : [];
  } catch {
    return [];
  }
}
function findSqlFiles(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((f) => f.isFile() && f.name.endsWith(".sql")).map((f) => f.name).sort();
  } catch {
    return [];
  }
}
function exec(args) {
  return new Promise((resolve) => {
    const child = spawn("npx", args, {
      cwd: CWD,
      stdio: "inherit",
      shell: true
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}
async function main() {
  const drizzleDir = join(CWD, "drizzle");
  const files = findSqlFiles(drizzleDir);
  if (files.length === 0) {
    console.log("No .sql files found in drizzle/");
    process.exit(1);
  }
  const bindings = getD1Bindings();
  let binding;
  const bindingOptions = bindings.map((b) => ({
    label: `${b.binding} (${b.database_name})`,
    value: b.binding
  }));
  bindingOptions.push({ label: "Manual input", value: "__manual__" });
  const picked = await select("Select D1 database:", bindingOptions);
  if (picked === "__manual__") {
    binding = await textInput("Enter D1 binding name:");
    if (!binding) {
      console.log("No binding name provided.");
      process.exit(1);
    }
  } else {
    binding = picked;
  }
  const file = await select(
    "Select migration file:",
    files.map((f) => ({ label: f, value: f }))
  );
  const target = await select("Execute on:", [
    { label: "Local", value: "local" },
    { label: "Remote", value: "remote" }
  ]);
  const filePath = join(drizzleDir, file);
  const args = ["wrangler", "d1", "execute", binding, "--file", filePath, `--${target}`];
  console.log(`
\x1B[2m$ npx ${args.join(" ")}\x1B[0m
`);
  const exitCode = await exec(args);
  process.exit(exitCode);
}
main();
