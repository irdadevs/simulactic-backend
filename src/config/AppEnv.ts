import { z } from "zod";

const NodeEnvSchema = z.enum(["development", "test", "production"]).default("development");

const AppEnvSchema = z
  .object({
    NODE_ENV: NodeEnvSchema,
    PORT: z.coerce.number().int().min(1).max(65535).default(8080),
    CORS_ORIGIN: z.string().optional(),
    DATABASE_URL: z.string().min(1),
    PGPORT: z.coerce.number().int().min(1).max(65535).default(5432),
    PGSSL: z
      .string()
      .optional()
      .default("false")
      .transform((value) => value === "true"),
    PGMAX: z.coerce.number().int().min(1).max(100).default(10),
    PGIDLE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(10000),
    PGCONNECTION_TIMEOUT_MS: z.coerce.number().int().min(100).max(120000).default(5000),
    PGSTATEMENT_TIMEOUT_MS: z.coerce.number().int().min(100).max(120000).default(10000),
    PGQUERY_TIMEOUT_MS: z.coerce.number().int().min(100).max(120000).default(10000),
    JWT_ISSUER: z.string().min(1),
    JWT_AUDIENCE: z.string().min(1),
  })
  .superRefine((env, ctx) => {
    if (
      env.NODE_ENV === "production" &&
      (!env.CORS_ORIGIN || env.CORS_ORIGIN.trim().length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CORS_ORIGIN"],
        message: "CORS_ORIGIN is required in production.",
      });
    }
  });

export type AppEnv = {
  NODE_ENV: "development" | "test" | "production";
  PORT: number;
  CORS_ORIGIN?: string;
  CORS_ORIGINS: string[] | true;
  DATABASE_URL: string;
  PGPORT: number;
  PGSSL: boolean;
  PGMAX: number;
  PGIDLE_TIMEOUT_MS: number;
  PGCONNECTION_TIMEOUT_MS: number;
  PGSTATEMENT_TIMEOUT_MS: number;
  PGQUERY_TIMEOUT_MS: number;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
};

function parseCorsOrigins(value?: string): string[] | true {
  if (!value || value.trim().length === 0) return true;
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function loadAppEnv(env = process.env): AppEnv {
  const parsed = AppEnvSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const value = parsed.data;
  return {
    NODE_ENV: value.NODE_ENV,
    PORT: value.PORT,
    CORS_ORIGIN: value.CORS_ORIGIN,
    DATABASE_URL: value.DATABASE_URL,
    PGPORT: value.PGPORT,
    PGSSL: value.PGSSL,
    PGMAX: value.PGMAX,
    PGIDLE_TIMEOUT_MS: value.PGIDLE_TIMEOUT_MS,
    PGCONNECTION_TIMEOUT_MS: value.PGCONNECTION_TIMEOUT_MS,
    PGSTATEMENT_TIMEOUT_MS: value.PGSTATEMENT_TIMEOUT_MS,
    PGQUERY_TIMEOUT_MS: value.PGQUERY_TIMEOUT_MS,
    JWT_ISSUER: value.JWT_ISSUER,
    JWT_AUDIENCE: value.JWT_AUDIENCE,
    CORS_ORIGINS: parseCorsOrigins(value.CORS_ORIGIN),
  };
}
