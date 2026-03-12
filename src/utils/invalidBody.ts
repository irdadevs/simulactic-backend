import { Response } from "express";
import { ZodError, ZodIssue } from "zod";

type ValidationIssue = {
  field: string;
  message: string;
  code: string;
};

function pathToField(path: PropertyKey[]): string {
  if (path.length === 0) {
    return "request";
  }

  return path
    .map((segment) => (typeof segment === "number" ? `[${segment}]` : String(segment)))
    .join(".")
    .replace(".[", "[");
}

function normalizeIssues(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue: ZodIssue) => ({
    field: pathToField(issue.path),
    message: issue.message,
    code: issue.code,
  }));
}

function buildClientMessage(issues: ValidationIssue[]): string {
  const firstIssue = issues[0];
  if (!firstIssue) {
    return "Request validation failed.";
  }

  if (firstIssue.field === "request") {
    return firstIssue.message;
  }

  return `Invalid "${firstIssue.field}": ${firstIssue.message}`;
}

export default function invalidBody(res: Response, details: unknown) {
  const issues = details instanceof ZodError ? normalizeIssues(details) : [];

  return res.status(400).json({
    ok: false,
    error: "INVALID_BODY",
    message: buildClientMessage(issues),
    details: issues.length > 0 ? issues : details,
  });
}
