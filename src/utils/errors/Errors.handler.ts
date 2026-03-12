import { Response } from "express";
import { BaseError } from "./Errors.base";
import { CONSOLE_COLORS } from "../Chalk";

const DEFAULT_ERROR = {
  error: "INTERNAL_ERROR",
  message: "Something went wrong.",
};

function logHiddenError(err: unknown, status: number): void {
  const label = CONSOLE_COLORS.labelColor("[! ERROR]");
  const color = CONSOLE_COLORS.errorColor;

  if (err instanceof BaseError) {
    const meta = err.meta ? ` meta=${JSON.stringify(err.meta)}` : "";
    const cause =
      err.cause instanceof Error
        ? ` cause=${err.cause.message}`
        : err.cause
          ? ` cause=${String(err.cause)}`
          : "";
    console.error(
      `${label} ${color(
        `HTTP ${status} ${err.code} (${err.layer ?? "Unknown Layer"}): ${err.message}${meta}${cause}`,
      )}`,
    );
    return;
  }

  if (err instanceof Error) {
    console.error(
      `${label} ${color(`HTTP ${status} INTERNAL_ERROR: ${err.message}`)}`,
      err.stack,
    );
    return;
  }

  console.error(`${label} ${color(`HTTP ${status} INTERNAL_ERROR: ${String(err)}`)}`);
}

export default function errorHandler(err: unknown, res: Response) {
  if (err instanceof BaseError) {
    res.locals.errorMeta = {
      code: err.code,
      message: err.message,
      layer: err.layer,
      meta: err.meta,
    };
    const status = err.httpCode ?? 500;

    if (err.isPublic) {
      return res.status(status).json({
        ok: false,
        error: err.code,
        message: err.message,
      });
    }

    logHiddenError(err, status);

    return res.status(status).json({
      ok: false,
      ...DEFAULT_ERROR,
    });
  }

  res.locals.errorMeta = {
    code: "INTERNAL_ERROR",
    message: err instanceof Error ? err.message : String(err),
    layer: "Unknown",
  };
  logHiddenError(err, 500);
  return res.status(500).json({
    ok: false,
    ...DEFAULT_ERROR,
  });
}
