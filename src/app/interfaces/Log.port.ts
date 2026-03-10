import { Log, LogCategory, LogLevel } from "../../domain/aggregates/Log";

export type CreateLogInput = {
  source: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  context?: Record<string, unknown>;
  userId?: string | null;
  requestId?: string | null;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  ip?: string | null;
  userAgent?: string | null;
  fingerprint?: string | null;
  tags?: string[];
  occurredAt?: Date;
};

export type ListLogsQuery = {
  level?: LogLevel;
  category?: LogCategory;
  source?: string;
  requestId?: string;
  userId?: string;
  statusCode?: number;
  unresolvedOnly?: boolean;
  from?: Date;
  to?: Date;
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: "occurredAt" | "level" | "category";
  orderDir?: "asc" | "desc";
};

export interface ILog {
  save(log: Log): Promise<Log>;
  findById(id: string): Promise<Log | null>;
  list(query: ListLogsQuery): Promise<{ rows: Log[]; total: number }>;
  resolve(id: string, byUserId: string): Promise<Log>;
  reopen(id: string): Promise<Log>;
  setAdminNote(id: string, note: string, byUserId: string): Promise<Log>;
  clearAdminNote(id: string): Promise<Log>;
}
