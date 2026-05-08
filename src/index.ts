import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const CWD = process.cwd();

// ─── Arrow-key single-select prompt ───

async function select<T extends string>(
  message: string,
  options: { label: string; value: T }[]
): Promise<T> {
  let cursor = 0;

  const render = () => {
    process.stdout.write(`\x1b[${options.length + 1}A`);
    process.stdout.write(`\x1b[36m?\x1b[0m ${message}\n`);
    for (let i = 0; i < options.length; i++) {
      const prefix = i === cursor ? "\x1b[36m❯\x1b[0m" : " ";
      const text =
        i === cursor
          ? `\x1b[36m${options[i].label}\x1b[0m`
          : `\x1b[2m${options[i].label}\x1b[0m`;
      process.stdout.write(`\x1b[2K${prefix} ${text}\n`);
    }
  };

  process.stdout.write("\n".repeat(options.length + 1));
  render();

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  return new Promise<T>((resolve) => {
    const onData = (key: string) => {
      if (key === "\x1b[A") {
        cursor = (cursor - 1 + options.length) % options.length;
        render();
      } else if (key === "\x1b[B") {
        cursor = (cursor + 1) % options.length;
        render();
      } else if (key === "\r" || key === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onData);
        resolve(options[cursor].value);
      } else if (key === "\x03") {
        process.stdout.write("\n");
        process.exit(0);
      }
    };
    process.stdin.on("data", onData);
  });
}

// ─── Text input prompt ───

async function textInput(message: string): Promise<string> {
  process.stdout.write(`\x1b[36m?\x1b[0m ${message} `);
  process.stdin.setRawMode(false);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  return new Promise<string>((resolve) => {
    const onData = (data: string) => {
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      resolve(data.trim());
    };
    process.stdin.on("data", onData);
  });
}

// ─── Parse D1 bindings from wrangler config ───

function findWranglerConfig(): string | null {
  for (const name of ["wrangler.jsonc", "wrangler.json"]) {
    try {
      const path = join(CWD, name);
      readFileSync(path);
      return path;
    } catch {
      // not found, try next
    }
  }
  return null;
}

function getD1Bindings(): { binding: string; database_name: string }[] {
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

// ─── Find SQL migration dir ───

function findSqlFiles(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((f) => f.isFile() && f.name.endsWith(".sql"))
      .map((f) => f.name)
      .sort();
  } catch {
    return [];
  }
}

// ─── Execute wrangler command ───

function exec(args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("npx", args, {
      cwd: CWD,
      stdio: "inherit",
      shell: true,
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

// ─── Main ───

async function main() {
  const drizzleDir = join(CWD, "drizzle");
  const files = findSqlFiles(drizzleDir);

  if (files.length === 0) {
    console.log("No .sql files found in drizzle/");
    process.exit(1);
  }

  // D1 binding selection
  const bindings = getD1Bindings();
  let binding: string;

  const bindingOptions = bindings.map((b) => ({
    label: `${b.binding} (${b.database_name})`,
    value: b.binding,
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

  // File selection
  const file = await select(
    "Select migration file:",
    files.map((f) => ({ label: f, value: f }))
  );

  // Target selection
  const target = await select("Execute on:", [
    { label: "Local", value: "local" as const },
    { label: "Remote", value: "remote" as const },
  ]);

  // Execute
  const filePath = join(drizzleDir, file);
  const args = ["wrangler", "d1", "execute", binding, "--file", filePath, `--${target}`];

  console.log(`\n\x1b[2m$ npx ${args.join(" ")}\x1b[0m\n`);

  const exitCode = await exec(args);
  process.exit(exitCode);
}

main();
