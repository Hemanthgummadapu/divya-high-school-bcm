import { createHmac, randomBytes } from "node:crypto";
import { createWriteStream, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const workDir = join(tmpdir(), `qb-rpc-it-${process.pid}`);
const pgData = join(workDir, "pgdata");
const jwtSecret = randomBytes(32).toString("hex");

function mintJwt(role) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url",
  );
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      role,
      iss: "supabase",
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", jwtSecret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function findBin(names) {
  const brewPrefixes = [
    "/opt/homebrew/opt/postgresql@16/bin",
    "/opt/homebrew/opt/postgresql@17/bin",
    "/opt/homebrew/opt/postgresql/bin",
    "/usr/lib/postgresql/16/bin",
  ];
  for (const prefix of brewPrefixes) {
    for (const name of names) {
      const candidate = join(prefix, name.replace(/.*\//, ""));
      const check = spawnSync("test", ["-x", candidate]);
      if (check.status === 0) return candidate;
    }
  }
  for (const name of names) {
    const result = spawnSync("bash", ["-lc", `command -v ${name}`], {
      encoding: "utf8",
    });
    const path = (result.stdout || "").trim();
    if (result.status === 0 && path) return path;
  }
  return null;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    ...options,
  });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").slice(0, 2000);
    throw new Error(`${command} ${args.join(" ")} failed: ${err}`);
  }
  return result;
}

function waitFor(fn, label, timeoutMs = 20000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        if (await fn()) return resolve();
      } catch (error) {
        if (String(error.message || error).startsWith("postgrest exited")) {
          return reject(error);
        }
      }
      if (Date.now() - started > timeoutMs) {
        return reject(new Error(`timed out waiting for ${label}`));
      }
      setTimeout(tick, 200);
    };
    tick();
  });
}

async function downloadPostgrest(destDir) {
  const existing = findBin(["postgrest"]);
  if (existing) return existing;
  mkdirSync(destDir, { recursive: true });
  const url =
    "https://github.com/PostgREST/postgrest/releases/download/v12.2.12/postgrest-v12.2.12-macos-aarch64.tar.xz";
  const archive = join(destDir, "postgrest.tar.xz");
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`postgrest download failed: ${response.status}`);
  }
  await pipeline(response.body, createWriteStream(archive));
  const extract = spawnSync(
    "tar",
    ["-xJf", archive, "-C", destDir],
    { encoding: "utf8" },
  );
  if (extract.status !== 0) {
    throw new Error(`postgrest extract failed: ${extract.stderr}`);
  }
  const binary = join(destDir, "postgrest");
  const check = spawnSync("test", ["-x", binary]);
  if (check.status !== 0) {
    throw new Error("postgrest binary missing after extract");
  }
  return binary;
}

const DISPLAY_NAME_MIGRATION = "20260817000000_question_sources_display_name.sql";

function applyMigrations(psql, env) {
  const bootstrap = join(root, "scripts/question-bank-v2-rpc-integration-bootstrap.sql");
  run(psql, ["-v", "ON_ERROR_STOP=1", "-f", bootstrap], { env });
  const migrationsDir = join(root, "supabase/migrations");
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const prior = files.filter((name) => name !== DISPLAY_NAME_MIGRATION);
  const displayName = files.find((name) => name === DISPLAY_NAME_MIGRATION);
  for (const file of prior) {
    run(psql, ["-v", "ON_ERROR_STOP=1", "-f", join(migrationsDir, file)], { env });
  }
  run(
    psql,
    [
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      join(root, "scripts/question-bank-v2-display-name-backfill-fixtures.sql"),
    ],
    { env },
  );
  if (!displayName) {
    throw new Error("display_name migration is missing");
  }
  run(psql, ["-v", "ON_ERROR_STOP=1", "-f", join(migrationsDir, displayName)], {
    env,
  });
  run(
    psql,
    [
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      join(root, "scripts/question-bank-v2-display-name-backfill-verify.sql"),
    ],
    { env },
  );
  process.stderr.write("display_name backfill verified\n");
}

async function main() {
  mkdirSync(workDir, { recursive: true });
  const initdb = findBin(["initdb"]);
  const pgCtl = findBin(["pg_ctl"]);
  const psql = findBin(["psql"]);
  const postgres = findBin(["postgres"]);
  if (!initdb || !pgCtl || !psql || !postgres) {
    throw new Error("local PostgreSQL binaries were not found");
  }

  const pgPort = 55432 + (process.pid % 1000);
  const restPort = pgPort + 1;
  run(initdb, ["-D", pgData, "-A", "trust", "-U", "postgres", "--no-instructions"]);
  const logFile = join(workDir, "postgres.log");
  run(pgCtl, [
    "-D",
    pgData,
    "-l",
    logFile,
    "start",
    "-o",
    `-p ${pgPort} -k ${workDir}`,
  ], {
    env: {
      ...process.env,
      LC_ALL: "en_US.UTF-8",
      LANG: "en_US.UTF-8",
    },
  });

  const pgEnv = {
    ...process.env,
    PGHOST: workDir,
    PGPORT: String(pgPort),
    PGUSER: "postgres",
    PGDATABASE: "postgres",
  };

  try {
    await waitFor(() => {
      const result = spawnSync(psql, ["-c", "SELECT 1"], { env: pgEnv });
      return result.status === 0;
    }, "postgres");

    applyMigrations(psql, pgEnv);
    process.stderr.write("migrations applied\n");

    const postgrest = await downloadPostgrest(join(workDir, "postgrest-bin"));
    process.stderr.write(`postgrest binary ${postgrest}\n`);
    const help = spawnSync(postgrest, ["--help"], { encoding: "utf8" });
    process.stderr.write((help.stdout || help.stderr || "").slice(0, 200) + "\n");
    const rest = spawn(
      postgrest,
      [],
      {
        env: {
          ...process.env,
          DYLD_LIBRARY_PATH: [
            "/opt/homebrew/opt/postgresql@16/lib",
            "/opt/homebrew/opt/libpq/lib",
            process.env.DYLD_LIBRARY_PATH || "",
          ].filter(Boolean).join(":"),
          PGRST_DB_URI: `postgres://authenticator:rpc_integration_authenticator@127.0.0.1:${pgPort}/postgres?sslmode=disable`,
          PGRST_DB_SCHEMAS: "public",
          PGRST_DB_ANON_ROLE: "anon",
          PGRST_JWT_SECRET: jwtSecret,
          PGRST_SERVER_PORT: String(restPort),
          PGRST_SERVER_HOST: "127.0.0.1",
          PGRST_DB_CHANNEL_ENABLED: "false",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const restLog = [];
    rest.stdout.on("data", (chunk) => restLog.push(String(chunk)));
    rest.stderr.on("data", (chunk) => restLog.push(String(chunk)));

    try {
      await waitFor(async () => {
        if (rest.exitCode !== null) {
          throw new Error(`postgrest exited ${rest.exitCode}: ${restLog.join("")}`);
        }
        const response = await fetch(`http://127.0.0.1:${restPort}/`, {
          headers: { apikey: mintJwt("anon") },
        });
        return response.status < 500;
      }, "postgrest");

      const testEnv = {
        ...process.env,
        RPC_TEST_POSTGREST_URL: `http://127.0.0.1:${restPort}`,
        RPC_TEST_SERVICE_KEY: mintJwt("service_role"),
        RPC_TEST_ANON_KEY: mintJwt("anon"),
        RPC_TEST_AUTH_KEY: mintJwt("authenticated"),
      };
      const test = spawnSync(
        process.execPath,
        ["--test", join(root, "scripts/question-bank-v2-rpc-integration.test.mjs")],
        { env: testEnv, encoding: "utf8" },
      );
      if (test.stdout) process.stdout.write(test.stdout);
      if (test.stderr) process.stderr.write(test.stderr);
      if (test.status !== 0) {
        process.stderr.write(restLog.join("").slice(0, 4000));
        throw new Error("RPC integration tests failed");
      }
    } catch (error) {
      process.stderr.write(restLog.join("").slice(0, 4000));
      throw error;
    } finally {
      rest.kill("SIGTERM");
    }
  } finally {
    spawnSync(pgCtl, ["-D", pgData, "stop", "-m", "fast"]);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
