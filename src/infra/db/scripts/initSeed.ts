import dotenv from "dotenv";
dotenv.config({
  path: process.env.NODE_ENV === "production" ? ".env.production" : ".env",
});

import { PgPoolQueryable } from "../Postgres";
import { PgUnitOfWorkFactory } from "../PostgresUoW";
import { CONSOLE_COLORS } from "../../../utils/Chalk";
import { ErrorFactory } from "../../../utils/errors/Error.map";

function logInfo(message: string): void {
  console.log(`${CONSOLE_COLORS.labelColor("[# DB]")} ${CONSOLE_COLORS.infoColor(message)}`);
}

function logSuccess(message: string): void {
  console.log(`${CONSOLE_COLORS.labelColor("[# DB]")} ${CONSOLE_COLORS.successColor(message)}`);
}

function logWarn(message: string): void {
  console.log(`${CONSOLE_COLORS.labelColor("[# DB]")} ${CONSOLE_COLORS.warningColor(message)}`);
}

async function main() {
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

    logInfo("seeding supporter badges");
    await uow.db.query(
      `
      INSERT INTO billing.supporter_badges (branch, level, name, quantity_label, threshold)
      VALUES
        ('amount', 1, 'Bronze Patron', '5 EUR', 500),
        ('amount', 2, 'Silver Patron', '20 EUR', 2000),
        ('amount', 3, 'Gold Patron', '50 EUR', 5000),
        ('amount', 4, 'Platinum Patron', '100 EUR', 10000),
        ('amount', 5, 'Titan Patron', '250 EUR', 25000),
        ('amount', 6, 'Legend Patron', '500 EUR', 50000),
        ('months', 1, 'Monthly Initiate', '1 month', 1),
        ('months', 2, 'Monthly Cadet', '3 months', 3),
        ('months', 3, 'Monthly Officer', '6 months', 6),
        ('months', 4, 'Monthly Captain', '12 months', 12),
        ('months', 5, 'Monthly Admiral', '24 months', 24),
        ('months', 6, 'Monthly Sovereign', '36 months', 36)
      ON CONFLICT (branch, level) DO UPDATE SET
        name = EXCLUDED.name,
        quantity_label = EXCLUDED.quantity_label,
        threshold = EXCLUDED.threshold
      `,
    );

    logInfo("seeding resources families");
    await uow.db.query(
      `
      INSERT INTO assets.resource_families (id, name)
      VALUES
        (1, 'energy'),
        (2, 'raw'),
        (3, 'refined'),
        (4, 'rare'),
        (5, 'exotic'),
      ON CONFLICT (id, name) DO UPDATE SET
        name = EXCLUDED.name,
      `,
    );

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
