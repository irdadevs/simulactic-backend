import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { PgPoolQueryable } from "../../infra/db/Postgres";
import { PgUnitOfWorkFactory } from "../../infra/db/PostgresUoW";
import { RedisRepo } from "../../infra/repos/Redis.repository";

dotenv.config();

export type RealInfraContext = {
  db: PgPoolQueryable;
  uowFactory: PgUnitOfWorkFactory;
  cache: RedisRepo;
  resetDatabase: () => Promise<void>;
  resetCache: () => Promise<void>;
  close: () => Promise<void>;
};

export const RUN_REAL_INFRA_TESTS =
  (process.env.RUN_REAL_INFRA_TESTS ?? "").trim().toLowerCase() === "true";

export function ensureRealTestEnv(): void {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET ??= "test_access_secret_1234567890";
  process.env.JWT_REFRESH_SECRET ??= "test_refresh_secret_1234567890";
  process.env.JWT_ISSUER ??= "galactic-api-test";
  process.env.JWT_AUDIENCE ??= "galactic-client-test";
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var for real infra tests: ${name}`);
  }
  return value;
}

async function applyMigrations(db: PgPoolQueryable): Promise<void> {
  await db.query(`CREATE SCHEMA IF NOT EXISTS logs;`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS logs.test_migration_log (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const migrationsDir = path.join(process.cwd(), "src", "infra", "db", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  for (const file of files) {
    const already = await db.query<{ filename: string }>(
      `SELECT filename FROM logs.test_migration_log WHERE filename = $1`,
      [file],
    );
    if (already.rowCount > 0) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    try {
      await db.query(sql);
    } catch (error: unknown) {
      if (!isDuplicateObjectError(error)) {
        throw error;
      }
      // Idempotency fallback for legacy non-IF-NOT-EXISTS statements in migrations.
    }
    await db.query(
      `INSERT INTO logs.test_migration_log (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`,
      [file],
    );
  }
}

let migrationsBootstrapped = false;
let migrationsBootstrapPromise: Promise<void> | null = null;

async function ensureMigrationsBootstrapped(db: PgPoolQueryable): Promise<void> {
  if (migrationsBootstrapped) return;
  if (!migrationsBootstrapPromise) {
    migrationsBootstrapPromise = (async () => {
      await applyMigrations(db);
      migrationsBootstrapped = true;
    })();
  }
  await migrationsBootstrapPromise;
}

function isDuplicateObjectError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  return code === "42710";
}

async function seedRoles(db: PgPoolQueryable): Promise<void> {
  await db.query(
    `
      INSERT INTO auth.roles (id, key)
      VALUES (1, 'User'), (2, 'Admin')
      ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key
    `,
  );
}

async function truncateAll(db: PgPoolQueryable): Promise<void> {
  await db.query(
    `
      TRUNCATE TABLE
        auth.user_sessions,
        auth.user_roles,
        procedurals.moons,
        procedurals.planets,
        procedurals.stars,
        procedurals.asteroids,
        procedurals.systems,
        procedurals.galaxies,
        billing.fx_rates_daily,
        billing.donations,
        billing.donations_archive,
        metrics.performance_metrics,
        metrics.performance_metrics_archive,
        metrics.events,
        metrics.daily_usage,
        logs.error_log,
        logs.error_log_archive,
        logs.maintenance_job_runs,
        logs.archive_partition_plan,
        auth.users
      RESTART IDENTITY CASCADE
    `,
  );
}

export async function createRealInfraContext(testName: string): Promise<RealInfraContext> {
  ensureRealTestEnv();
  requireEnv("DATABASE_URL");
  requireEnv("REDIS_URL");

  const db = await PgPoolQueryable.connect(
    {
      connectionString: process.env.DATABASE_URL,
      port: Number(process.env.PGPORT ?? 5432),
      ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
      max: Number(process.env.PGMAX ?? 10),
      idleTimeoutMillis: Number(process.env.PGIDLE_TIMEOUT_MS ?? 10000),
    },
    console,
    5,
  );

  await ensureMigrationsBootstrapped(db);
  await seedRoles(db);

  const uowFactory = new PgUnitOfWorkFactory(db._getPool());
  const cache = new RedisRepo({
    keyPrefix: `test:${testName}:${Date.now()}`,
  });

  const resetDatabase = async () => {
    await truncateAll(db);
    await seedRoles(db);
  };

  const resetCache = async () => {
    await cache.delByPrefix("");
  };

  const close = async () => {
    await cache.close();
    await db.close();
  };

  return {
    db,
    uowFactory,
    cache,
    resetDatabase,
    resetCache,
    close,
  };
}
