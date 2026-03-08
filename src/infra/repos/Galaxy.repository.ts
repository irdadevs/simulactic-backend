import {
  GalaxyAggregateCounts,
  GlobalProceduralCounts,
  IGalaxy,
  ListGalaxyQuery,
} from "../../app/interfaces/Galaxy.port";
import { Queryable, QueryResultRow } from "../../config/db/Queryable";
import { paginateFrom } from "../../utils/Pagination";
import { ErrorFactory } from "../../utils/errors/Error.map";
import { Galaxy, GalaxyName, GalaxyShape, GalaxyShapeValue } from "../../domain/aggregates/Galaxy";
import { Uuid } from "../../domain/aggregates/User";

export default class GalaxyRepo implements IGalaxy {
  constructor(private readonly db: Queryable) {}

  private mapRow(row: QueryResultRow): Galaxy {
    return Galaxy.rehydrate({
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      shape: row.shape as GalaxyShapeValue,
      systemCount: row.system_count,
      createdAt: row.created_at,
    });
  }

  private async findOneBy(whereSql: string, params: any[]): Promise<Galaxy | null> {
    const sql = `
      SELECT id, owner_id, name, shape, system_count, created_at
      FROM procedurals.galaxies
      ${whereSql}
      LIMIT 1
    `;

    const query = await this.db.query(sql, params);
    if (query.rowCount === 0) return null;
    return this.mapRow(query.rows[0]);
  }

  async create(galaxy: Galaxy): Promise<Galaxy> {
    return this.save(galaxy);
  }

  async save(galaxy: Galaxy): Promise<Galaxy> {
    const dto = galaxy.toDB();
    await this.db.query(
      `
      INSERT INTO procedurals.galaxies
        (id, owner_id, name, shape, system_count, created_at)
      VALUES
        ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        owner_id = EXCLUDED.owner_id,
        name = EXCLUDED.name,
        shape = EXCLUDED.shape,
        system_count = EXCLUDED.system_count,
        created_at = EXCLUDED.created_at,
        updated_at = now_utc()
      `,
      [dto.id, dto.owner_id, dto.name, dto.shape, dto.system_count, dto.created_at],
    );
    return galaxy;
  }

  async findById(id: Uuid): Promise<Galaxy | null> {
    return this.findOneBy("WHERE id = $1", [id.toString()]);
  }

  async findByOwner(ownerId: Uuid): Promise<Galaxy | null> {
    return this.findOneBy("WHERE owner_id = $1", [ownerId.toString()]);
  }

  async countByOwner(ownerId: Uuid): Promise<number> {
    const query = await this.db.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM procedurals.galaxies WHERE owner_id = $1`,
      [ownerId.toString()],
    );
    return Number(query.rows[0]?.total ?? 0);
  }

  async findByName(name: GalaxyName): Promise<Galaxy | null> {
    return this.findOneBy("WHERE name = $1", [name.toString()]);
  }

  async findByShape(shape: GalaxyShape): Promise<Galaxy | null> {
    return this.findOneBy("WHERE shape = $1", [shape.toString()]);
  }

  async list(query: ListGalaxyQuery): Promise<{ rows: Galaxy[]; total: number }> {
    const params: any[] = [];
    const conditions: string[] = [];

    if (query.search && query.search.trim().length > 0) {
      params.push(`%${query.search.trim()}%`);
      const idx = `$${params.length}`;
      conditions.push(`(name ILIKE ${idx} OR shape ILIKE ${idx} OR owner_id::text ILIKE ${idx})`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const fromSql = `
      FROM procedurals.galaxies
      ${whereClause}
    `;

    const orderMap: Record<string, string> = {
      createdAt: "created_at",
      name: "name",
      shape: "shape",
      owner: "owner_id",
    };

    const { rows, total } = await paginateFrom(this.db, fromSql, params, {
      orderMap,
      orderBy: query.orderBy,
      orderDir: query.orderDir,
      limit: query.limit,
      offset: query.offset,
      select: "id, owner_id, name, shape, system_count, created_at",
    });

    return { rows: rows.map((row) => this.mapRow(row)), total };
  }

  async getAggregateCounts(galaxyId: Uuid): Promise<GalaxyAggregateCounts> {
    const query = await this.db.query<GalaxyAggregateCounts>(
      `
      SELECT
        (SELECT COUNT(*)::int FROM procedurals.systems s WHERE s.galaxy_id = $1) AS systems,
        (
          SELECT COUNT(*)::int
          FROM procedurals.stars st
          INNER JOIN procedurals.systems sy ON sy.id = st.system_id
          WHERE sy.galaxy_id = $1
        ) AS stars,
        (
          SELECT COUNT(*)::int
          FROM procedurals.planets p
          INNER JOIN procedurals.systems sy ON sy.id = p.system_id
          WHERE sy.galaxy_id = $1
        ) AS planets,
        (
          SELECT COUNT(*)::int
          FROM procedurals.moons m
          INNER JOIN procedurals.planets p ON p.id = m.planet_id
          INNER JOIN procedurals.systems sy ON sy.id = p.system_id
          WHERE sy.galaxy_id = $1
        ) AS moons,
        (
          SELECT COUNT(*)::int
          FROM procedurals.asteroids a
          INNER JOIN procedurals.systems sy ON sy.id = a.system_id
          WHERE sy.galaxy_id = $1
        ) AS asteroids
      `,
      [galaxyId.toString()],
    );

    return (
      query.rows[0] ?? {
        systems: 0,
        stars: 0,
        planets: 0,
        moons: 0,
        asteroids: 0,
      }
    );
  }

  async getGlobalProceduralCounts(): Promise<GlobalProceduralCounts> {
    const query = await this.db.query<GlobalProceduralCounts>(
      `
      SELECT
        (SELECT COUNT(*)::int FROM procedurals.galaxies) AS galaxies,
        (SELECT COUNT(*)::int FROM procedurals.systems) AS systems,
        (SELECT COUNT(*)::int FROM procedurals.stars) AS stars,
        (SELECT COUNT(*)::int FROM procedurals.planets) AS planets,
        (SELECT COUNT(*)::int FROM procedurals.moons) AS moons,
        (SELECT COUNT(*)::int FROM procedurals.asteroids) AS asteroids
      `,
    );

    return (
      query.rows[0] ?? {
        galaxies: 0,
        systems: 0,
        stars: 0,
        planets: 0,
        moons: 0,
        asteroids: 0,
      }
    );
  }

  async changeName(id: Uuid, name: GalaxyName): Promise<Galaxy> {
    const res = await this.db.query(
      `UPDATE procedurals.galaxies SET name = $1, updated_at = now_utc() WHERE id = $2`,
      [name.toString(), id.toString()],
    );

    if (res.rowCount === 0) {
      throw ErrorFactory.infra("SHARED.NOT_FOUND", {
        sourceType: "galaxy",
        id: id.toString(),
      });
    }

    const galaxy = await this.findById(id);
    if (!galaxy) {
      throw ErrorFactory.infra("SHARED.NOT_FOUND", {
        sourceType: "galaxy",
        id: id.toString(),
      });
    }
    return galaxy;
  }

  async changeShape(id: Uuid, shape: GalaxyShape): Promise<Galaxy> {
    const res = await this.db.query(
      `UPDATE procedurals.galaxies SET shape = $1, updated_at = now_utc() WHERE id = $2`,
      [shape.toString(), id.toString()],
    );

    if (res.rowCount === 0) {
      throw ErrorFactory.infra("SHARED.NOT_FOUND", {
        sourceType: "galaxy",
        id: id.toString(),
      });
    }

    const galaxy = await this.findById(id);
    if (!galaxy) {
      throw ErrorFactory.infra("SHARED.NOT_FOUND", {
        sourceType: "galaxy",
        id: id.toString(),
      });
    }
    return galaxy;
  }

  async delete(id: Uuid): Promise<void> {
    const res = await this.db.query(`DELETE FROM procedurals.galaxies WHERE id = $1`, [
      id.toString(),
    ]);

    if (res.rowCount === 0) {
      throw ErrorFactory.infra("SHARED.NOT_FOUND", {
        sourceType: "galaxy",
        id: id.toString(),
      });
    }
  }
}
