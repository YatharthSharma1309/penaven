import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

const dataDir = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), ".local"),
  "penaven-local-db",
);

const child = spawn(
  "npx",
  [
    "--yes",
    "@electric-sql/pglite-socket",
    "--db",
    dataDir,
    "--port",
    "5433",
    "--host",
    "127.0.0.1",
    "--max-connections",
    "10",
  ],
  { stdio: "inherit", shell: process.platform === "win32" },
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
