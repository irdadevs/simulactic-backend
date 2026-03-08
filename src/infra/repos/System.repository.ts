import { ISystem } from "../../app/interfaces/System.port";
import { Queryable, QueryResultRow } from "../../config/db/Queryable";
import { ErrorFactory } from "../../utils/errors/Error.map";
import { System, SystemName, SystemPositionProps } from "../../domain/aggregates/System";
import { Uuid } from "../../domain/aggregates/User";

export default class SystemRepo implements ISystem {
  constructor(private readonly db: Queryable) {}

  private mapRow(row: QueryResultRow): System {
    return System.rehydrate({
      id: row.id,
      galaxyId: row.galaxy_id,
      name: row.name,
      position: {
        x: Number(row.position_x),
        y: Number(row.position_y),
        z: Number(row.position_z),
      },
    });
  }

  private async findOneBy(whereSql: string, params: any[]): Promise<System | null> {
    const sql = `
      SELECT id, galaxy_id, name, position_x, position_y, position_z
      FROM procedurals.systems
      ${whereSql}
      LIMIT 1
    `;
    const query = await this.db.query(sql, params);
    if (query.rowCount === 0) return null;
    return this.mapRow(query.rows[0]);
  }

  async create(system: System): Promise<System> {
    return this.save(system);
  }

  async save(system: System): Promise<System> {
    const dto = system.toDB();
    await this.db.query(
      `
      INSERT INTO procedurals.systems
        (id, galaxy_id, name, position_x, position_y, position_z)
      VALUES
        ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        galaxy_id = EXCLUDED.galaxy_id,
        name = EXCLUDED.name,
        position_x = EXCLUDED.position_x,
        position_y = EXCLUDED.position_y,
        position_z = EXCLUDED.position_z,
        updated_at = now_utc()
      `,
      [dto.id, dto.galaxy_id, dto.name, dto.position_x, dto.position_y, dto.position_z],
    );
    return system;
  }

  async findById(id: Uuid): Promise<System | null> {
    return this.findOneBy("WHERE id = $1", [id.toString()]);
  }

  async findByGalaxy(galaxyId: Uuid): Promise<{ rows: System[]; total: number }> {
    const query = await this.db.query(
      `
      SELECT id, galaxy_id, name, position_x, position_y, position_z
      FROM procedurals.systems
      WHERE galaxy_id = $1
      ORDER BY name ASC
      `,
      [galaxyId.toString()],
    );
    const rows = query.rows.map((row) => this.mapRow(row));
    return { rows, total: rows.length };
  }

  async findByName(name: SystemName): Promise<System | null> {
    return this.findOneBy("WHERE name = $1", [name.toString()]);
  }

  async findByPosition(position: SystemPositionProps): Promise<System | null> {
    return this.findOneBy("WHERE position_x = $1 AND position_y = $2 AND position_z = $3", [
      position.x,
      position.y,
      position.z,
    ]);
  }

  async changeName(id: Uuid, name: SystemName): Promise<System> {
    const value = name.toString();
    const res = await this.db.query(
      `UPDATE procedurals.systems SET name = $1, updated_at = now_utc() WHERE id = $2`,
      [value, id.toString()],
    );

    if (res.rowCount === 0) {
      throw ErrorFactory.infra("SHARED.NOT_FOUND", {
        sourceType: "system",
        id: id.toString(),
      });
    }

    const system = await this.findById(id);
    if (!system) {
      throw ErrorFactory.infra("SHARED.NOT_FOUND", {
        sourceType: "system",
        id: id.toString(),
      });
    }
    return system;
  }

  async changePosition(id: Uuid, position: SystemPositionProps): Promise<System> {
    const res = await this.db.query(
      `UPDATE procedurals.systems
       SET position_x = $1, position_y = $2, position_z = $3, updated_at = now_utc()
       WHERE id = $4`,
      [position.x, position.y, position.z, id.toString()],
    );

    if (res.rowCount === 0) {
      throw ErrorFactory.infra("SHARED.NOT_FOUND", {
        sourceType: "system",
        id: id.toString(),
      });
    }

    const system = await this.findById(id);
    if (!system) {
      throw ErrorFactory.infra("SHARED.NOT_FOUND", {
        sourceType: "system",
        id: id.toString(),
      });
    }
    return system;
  }

  async delete(id: Uuid): Promise<void> {
    const res = await this.db.query(`DELETE FROM procedurals.systems WHERE id = $1`, [
      id.toString(),
    ]);
    if (res.rowCount === 0) {
      throw ErrorFactory.infra("SHARED.NOT_FOUND", {
        sourceType: "system",
        id: id.toString(),
      });
    }
  }
}
