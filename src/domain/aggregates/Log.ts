import { ErrorFactory } from "../../utils/errors/Error.map";
import { Uuid } from "./User";

const ALLOWED_LOG_LEVELS = ["debug", "info", "warn", "error", "critical"] as const;
const ALLOWED_LOG_CATEGORIES = ["application", "security", "audit", "infrastructure"] as const;

export type LogLevel = (typeof ALLOWED_LOG_LEVELS)[number];
export type LogCategory = (typeof ALLOWED_LOG_CATEGORIES)[number];

export type LogCreateProps = {
  id?: string;
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
  resolvedAt?: Date | null;
  resolvedBy?: string | null;
  adminNote?: string | null;
  adminNoteUpdatedAt?: Date | null;
  adminNoteUpdatedBy?: string | null;
};

export class LogSource {
  private constructor(private readonly value: string) {}

  static create(value: string): LogSource {
    const normalized = value.trim();
    if (!normalized || normalized.length > 80) {
      throw ErrorFactory.domain("PRESENTATION.INVALID_FIELD", { field: "source" });
    }
    return new LogSource(normalized);
  }

  toString(): string {
    return this.value;
  }
}

export class LogMessage {
  private constructor(private readonly value: string) {}

  static create(value: string): LogMessage {
    const normalized = value.trim();
    if (!normalized || normalized.length > 1000) {
      throw ErrorFactory.domain("PRESENTATION.INVALID_FIELD", { field: "message" });
    }
    return new LogMessage(normalized);
  }

  toString(): string {
    return this.value;
  }
}

export class Log {
  private constructor(private props: {
    id: string;
    source: string;
    level: LogLevel;
    category: LogCategory;
    message: string;
    context: Record<string, unknown>;
    userId: string | null;
    requestId: string | null;
    method: string | null;
    path: string | null;
    statusCode: number | null;
    ip: string | null;
    userAgent: string | null;
    fingerprint: string | null;
    tags: string[];
    occurredAt: Date;
    resolvedAt: Date | null;
    resolvedBy: string | null;
    adminNote: string | null;
    adminNoteUpdatedAt: Date | null;
    adminNoteUpdatedBy: string | null;
  }) {}

  static create(input: LogCreateProps): Log {
    if (!ALLOWED_LOG_LEVELS.includes(input.level)) {
      throw ErrorFactory.domain("PRESENTATION.INVALID_FIELD", { field: "level" });
    }
    if (!ALLOWED_LOG_CATEGORIES.includes(input.category)) {
      throw ErrorFactory.domain("PRESENTATION.INVALID_FIELD", { field: "category" });
    }
    if (input.statusCode != null && (input.statusCode < 100 || input.statusCode > 599)) {
      throw ErrorFactory.domain("PRESENTATION.INVALID_FIELD", { field: "statusCode" });
    }

    const userId = input.userId ? Uuid.create(input.userId).toString() : null;
    const resolvedBy = input.resolvedBy ? Uuid.create(input.resolvedBy).toString() : null;
    const adminNoteUpdatedBy = input.adminNoteUpdatedBy
      ? Uuid.create(input.adminNoteUpdatedBy).toString()
      : null;

    return new Log({
      id: input.id ?? "0",
      source: LogSource.create(input.source).toString(),
      level: input.level,
      category: input.category,
      message: LogMessage.create(input.message).toString(),
      context: input.context ?? {},
      userId,
      requestId: input.requestId?.trim() || null,
      method: input.method?.trim() || null,
      path: input.path?.trim() || null,
      statusCode: input.statusCode ?? null,
      ip: input.ip?.trim() || null,
      userAgent: input.userAgent?.trim() || null,
      fingerprint: input.fingerprint?.trim() || null,
      tags: Array.isArray(input.tags) ? input.tags.map((t) => t.trim()).filter(Boolean) : [],
      occurredAt: input.occurredAt ?? new Date(),
      resolvedAt: input.resolvedAt ?? null,
      resolvedBy,
      adminNote: input.adminNote?.trim() || null,
      adminNoteUpdatedAt: input.adminNoteUpdatedAt ?? null,
      adminNoteUpdatedBy,
    });
  }

  static rehydrate(input: LogCreateProps & { id: string }): Log {
    return Log.create(input);
  }

  resolve(byUserId: string, at: Date = new Date()): void {
    this.props.resolvedAt = at;
    this.props.resolvedBy = Uuid.create(byUserId).toString();
  }

  setAdminNote(note: string, byUserId: string, at: Date = new Date()): void {
    const normalized = note.trim();
    if (!normalized || normalized.length > 4000) {
      throw ErrorFactory.presentation("PRESENTATION.INVALID_FIELD", { field: "adminNote" });
    }

    this.props.adminNote = normalized;
    this.props.adminNoteUpdatedAt = at;
    this.props.adminNoteUpdatedBy = Uuid.create(byUserId).toString();
  }

  clearAdminNote(): void {
    this.props.adminNote = null;
    this.props.adminNoteUpdatedAt = null;
    this.props.adminNoteUpdatedBy = null;
  }

  canBeReopened(): boolean {
    return this.props.level !== "info";
  }

  reopen(): void {
    if (!this.canBeReopened()) {
      throw ErrorFactory.presentation("PRESENTATION.INVALID_FIELD", { field: "reopen" });
    }
    this.props.resolvedAt = null;
    this.props.resolvedBy = null;
  }

  get id(): string { return this.props.id; }
  get level(): LogLevel { return this.props.level; }
  get category(): LogCategory { return this.props.category; }
  get source(): string { return this.props.source; }
  get message(): string { return this.props.message; }
  get context(): Record<string, unknown> { return { ...this.props.context }; }
  get userId(): string | null { return this.props.userId; }
  get requestId(): string | null { return this.props.requestId; }
  get method(): string | null { return this.props.method; }
  get path(): string | null { return this.props.path; }
  get statusCode(): number | null { return this.props.statusCode; }
  get ip(): string | null { return this.props.ip; }
  get userAgent(): string | null { return this.props.userAgent; }
  get fingerprint(): string | null { return this.props.fingerprint; }
  get tags(): string[] { return [...this.props.tags]; }
  get occurredAt(): Date { return this.props.occurredAt; }
  get resolvedAt(): Date | null { return this.props.resolvedAt; }
  get resolvedBy(): string | null { return this.props.resolvedBy; }
  get adminNote(): string | null { return this.props.adminNote; }
  get adminNoteUpdatedAt(): Date | null { return this.props.adminNoteUpdatedAt; }
  get adminNoteUpdatedBy(): string | null { return this.props.adminNoteUpdatedBy; }

  toJSON(): {
    id: string;
    source: string;
    level: LogLevel;
    category: LogCategory;
    message: string;
    context: Record<string, unknown>;
    userId: string | null;
    requestId: string | null;
    method: string | null;
    path: string | null;
    statusCode: number | null;
    ip: string | null;
    userAgent: string | null;
    fingerprint: string | null;
    tags: string[];
    occurredAt: Date;
    resolvedAt: Date | null;
    resolvedBy: string | null;
    adminNote: string | null;
    adminNoteUpdatedAt: Date | null;
    adminNoteUpdatedBy: string | null;
  } {
    return {
      id: this.id,
      source: this.source,
      level: this.level,
      category: this.category,
      message: this.message,
      context: this.context,
      userId: this.userId,
      requestId: this.requestId,
      method: this.method,
      path: this.path,
      statusCode: this.statusCode,
      ip: this.ip,
      userAgent: this.userAgent,
      fingerprint: this.fingerprint,
      tags: this.tags,
      occurredAt: this.occurredAt,
      resolvedAt: this.resolvedAt,
      resolvedBy: this.resolvedBy,
      adminNote: this.adminNote,
      adminNoteUpdatedAt: this.adminNoteUpdatedAt,
      adminNoteUpdatedBy: this.adminNoteUpdatedBy,
    };
  }
}
