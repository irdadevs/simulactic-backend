import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcrypt";
import { PgPoolQueryable } from "../Postgres";
import { PgUnitOfWorkFactory } from "../PostgresUoW";
import { CONSOLE_COLORS } from "../../../utils/Chalk";
import { ErrorFactory } from "../../../utils/errors/Error.map";

const ADMIN_EMAIL = "admin@galactic.dev";
const ADMIN_PASSWORD = "Galactic-dev";
const USERNAME = "galactic_username";

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

    logInfo("seeding admin user");
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    const userResult = await uow.db.query<{ id: string }>(
      `
      INSERT INTO auth.users (email, hashed_password, username, is_verified, verified_at)
      VALUES ($1, $2, $3, true, now_utc())
      ON CONFLICT (email)
      DO UPDATE SET
        hashed_password = EXCLUDED.hashed_password,
        is_verified = true,
        username = EXCLUDED.username,
        verified_at = COALESCE(auth.users.verified_at, now_utc()),
        updated_at = now_utc()
      RETURNING id
      `,
      [ADMIN_EMAIL, hashedPassword, USERNAME],
    );

    const userId = userResult.rows[0]?.id;
    if (!userId) {
      throw ErrorFactory.infra("INFRA.DATABASE_CONNECTION", {
        reason: "admin user upsert did not return id",
      });
    }

    const roleResult = await uow.db.query<{ id: number }>(
      `SELECT id FROM auth.roles WHERE key = 'Admin'`,
    );
    const roleId = roleResult.rows[0]?.id;
    if (!roleId) {
      throw ErrorFactory.infra("INFRA.DATABASE_CONNECTION", {
        reason: "admin role not found",
      });
    }

    await uow.db.query(
      `
      INSERT INTO auth.user_roles (user_id, role_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      `,
      [userId, roleId],
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
