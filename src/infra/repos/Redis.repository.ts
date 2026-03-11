import { createClient, RedisClientType } from "redis";
import { ICache, DEFAULT_TTL } from "../../app/interfaces/Cache.port";
import { CONSOLE_COLORS } from "../../utils/Chalk";

export type RedisOptions = {
  url?: string; // e.g. redis://localhost:6379
  username?: string;
  password?: string;
  keyPrefix?: string; // multi-tenant, env, etc.
};

export class RedisRepo implements ICache {
  private client: RedisClientType;
  private prefix: string;
  private closed = false;

  constructor(opts: RedisOptions = {}) {
    this.client = createClient({
      url: opts.url || process.env.REDIS_URL,
      username: opts.username || process.env.REDIS_USERNAME,
      password: opts.password || process.env.REDIS_PASSWORD,
    });
    this.prefix = opts.keyPrefix ? `${opts.keyPrefix}:` : "";
    this.client.on("error", (e) => {
      console.log(
        `${CONSOLE_COLORS.labelColor("[* REDIS]")} ${CONSOLE_COLORS.errorColor(`error. ${e}`)}`,
      );
    });
  }

  async connect() {
    if (this.closed) {
      throw new Error("Redis client already closed");
    }
    if (!this.client.isOpen) {
      console.log(
        `${CONSOLE_COLORS.labelColor("[* REDIS]")} ${CONSOLE_COLORS.successColor(`cache client ready.`)}`,
      );
      await this.client.connect();
    }
  }

  private k(key: string) {
    return this.prefix + key;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    await this.connect();
    const raw = await this.client.get(this.k(key));
    if (!raw) return null;
    try {
      return JSON.parse(raw as string) as T;
    } catch {
      return null;
    }
  }

  async set<T = unknown>(key: string, value: T, ttlSec = DEFAULT_TTL): Promise<void> {
    await this.connect();
    await this.client.set(this.k(key), JSON.stringify(value), { EX: ttlSec });
  }

  async del(key: string): Promise<void> {
    await this.connect();
    await this.client.del(this.k(key));
  }

  async delMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.connect();
    await this.client.del(keys.map((key) => this.k(key)));
  }

  async delByPrefix(prefix: string): Promise<number> {
    await this.connect();

    let deleted = 0;
    const pattern = this.k(`${prefix}*`);

    for await (const key of this.client.scanIterator({
      MATCH: pattern,
      COUNT: 100,
    })) {
      const keys = Array.isArray(key) ? key : [key];
      if (keys.length > 0) {
        await this.client.del(keys);
        deleted += keys.length;
      }
    }

    return deleted;
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.client.isOpen) {
      console.log(
        `${CONSOLE_COLORS.labelColor("[* REDIS]")} ${CONSOLE_COLORS.warningColor(`cache client connection closed.`)}`,
      );
      await this.client.quit();
    }
  }

  async ping(): Promise<void> {
    await this.connect();
    await this.client.ping();
  }
}
