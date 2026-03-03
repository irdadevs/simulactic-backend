export type QueryParams = any[] | undefined;

export type QueryResultRow = Record<string, any>;

export interface QueryResult<T extends QueryResultRow = QueryResultRow> {
  rows: T[];
  rowCount: number;
}

export type PgConfig = {
  connectionString?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  ssl?: boolean | { rejectUnauthorized?: boolean };
  max?: number; // pool size
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  statement_timeout?: number;
  query_timeout?: number;
};

export interface Queryable {
  /** Simple parameterized query */
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: QueryParams,
  ): Promise<QueryResult<T>>;

  /** Quick health check */
  ping(): Promise<void>;

  /** Graceful shutdown */
  close(): Promise<void>;
}
