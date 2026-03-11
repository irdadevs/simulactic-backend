import fs from "fs";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config({
  path: process.env.NODE_ENV === "production" ? ".env.production" : ".env",
});

import { PgPoolQueryable } from "../Postgres";
import { PgUnitOfWorkFactory } from "../PostgresUoW";
import { ErrorFactory } from "../../../utils/errors/Error.map";
import { CONSOLE_COLORS } from "../../../utils/Chalk";

const MIGRATIONS_DIR = path.join(process.cwd(), "src", "infra", "db", "migrations");

async function sha256(buf: Buffer | string) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function ensureMigrationLog(db: PgPoolQueryable): Promise<void> {
  await db.query(`
    CREATE SCHEMA IF NOT EXISTS logs;
    CREATE TABLE IF NOT EXISTS logs.migration_log (
      id bigserial PRIMARY KEY,
      filename text NOT NULL UNIQUE,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now(),
      applied_by text,
      execution_time_ms integer CHECK (execution_time_ms >= 0)
    );
  `);
}

function logInfo(message: string): void {
  console.log(`${CONSOLE_COLORS.labelColor("[⚙️DB]")} ${CONSOLE_COLORS.infoColor(message)}`);
}

function logSuccess(message: string): void {
  console.log(`${CONSOLE_COLORS.labelColor("[⚙️DB]")} ${CONSOLE_COLORS.successColor(message)}`);
}

function logWarn(message: string): void {
  console.log(`${CONSOLE_COLORS.labelColor("[⚙️DB]")} ${CONSOLE_COLORS.warningColor(message)}`);
}

async function main() {
  console.log("DATABASE_URL:", process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL);
  const db = await PgPoolQueryable.connect(
    {
      connectionString: process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL,
      ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
      max: Number(process.env.PGMAX ?? 10),
      idleTimeoutMillis: Number(process.env.PGIDLE_TIMEOUT_MS ?? 10000),
    },
    console,
    5,
  );

  await ensureMigrationLog(db);
  const uowFactory = new PgUnitOfWorkFactory(db._getPool());

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  for (const filename of files) {
    const full = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(full);
    const checksum = await sha256(sql);

    const existing = await db.query<{ checksum: string }>(
      `SELECT checksum FROM logs.migration_log WHERE filename = $1`,
      [filename],
    );
    if (existing.rowCount > 0) {
      const prev = existing.rows[0].checksum;
      if (prev !== checksum) {
        throw ErrorFactory.infra("INFRA.TRANSACTION_FAILED", {
          cause: `Checksum mismatch for ${filename}. Refuse to reapply changed migration.`,
        });
      }
      logInfo(`skip ${filename} (already applied)`);
      continue;
    }

    logInfo(`apply ${filename}`);
    const uow = await uowFactory.start();
    const startedAt = Date.now();
    try {
      await uow.db.query(sql.toString());
      await uow.db.query(
        `INSERT INTO logs.migration_log (filename, checksum, applied_by, execution_time_ms)
         VALUES ($1, $2, $3, $4)`,
        [filename, checksum, process.env.MIGRATION_USER ?? null, Date.now() - startedAt],
      );
      await uow.commit();
      logSuccess(`applied ${filename} (${Date.now() - startedAt}ms)`);
    } catch (err) {
      await uow.rollback();
      throw ErrorFactory.infra("INFRA.TRANSACTION_FAILED", {
        cause: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logSuccess("migrations complete");
  await db.close();
}

main().catch((e) => {
  logWarn(`migrations failed: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
