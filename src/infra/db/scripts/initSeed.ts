import dotenv from "dotenv";
dotenv.config();

import { PgPoolQueryable } from "../Postgres";
import { PgUnitOfWorkFactory } from "../PostgresUoW";
import { CONSOLE_COLORS } from "../../../utils/Chalk";
import { ErrorFactory } from "../../../utils/errors/Error.map";

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
  const db = await PgPoolQueryable.connect(
    {
      connectionString: process.env.DATABASE_URL,
      port: Number(process.env.PGPORT),
      ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
      max: Number(process.env.PGMAX ?? 10),
      idleTimeoutMillis: Number(process.env.PGIDLE_TIMEOUT_MS ?? 10000),
    },
    console,
    5,
  );

  const uowFactory = new PgUnitOfWorkFactory(db._getPool());
  const uow = await uowFactory.start();

  try {
    logInfo("seeding roles");
    await uow.db.query(
      `
      INSERT INTO auth.roles (id, key)
      VALUES (1, 'User'), (2, 'Admin')
      ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key
      `,
    );

    const roleResult = await uow.db.query<{ id: number }>(`
      SELECT id FROM auth.roles WHERE key = 'Admin'
    `);
    if (!roleResult.rows[0]?.id) {
      throw ErrorFactory.infra("INFRA.DATABASE_CONNECTION", {
        reason: "admin role not found",
      });
    }

    await uow.commit();
    logSuccess("seed completed");
  } catch (err) {
    await uow.rollback();
    throw ErrorFactory.infra("INFRA.TRANSACTION_FAILED", {
      cause: err instanceof Error ? err.message : String(err),
    });
  } finally {
    await db.close();
  }
}

main().catch((e) => {
  logWarn(`seed failed: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
