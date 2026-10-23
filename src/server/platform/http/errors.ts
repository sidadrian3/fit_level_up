import { NextResponse } from "next/server";
import { BSON } from "mongodb";
import { z } from "zod";
import { DomainError, type DomainErrorKind } from "@/server/platform/domain";

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = "Bad Request") {
    super(400, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(401, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Not Found") {
    super(404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Conflict") {
    super(409, message);
  }
}

export class IdempotencyKeyReusedError extends AppError {
  constructor(message: string) {
    super(422, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(403, message);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(public retryAfterSeconds: number, message: string = "Too many requests") {
    super(429, message);
  }
}

const DOMAIN_ERROR_STATUS: Record<DomainErrorKind, number> = {
  invalid: 400,
  conflict: 409,
};

export function toErrorResponse(err: unknown, routeName: string): NextResponse {
  if (err instanceof TooManyRequestsError) {
    return NextResponse.json(
      { error: err.message },
      { status: err.statusCode, headers: { "Retry-After": String(err.retryAfterSeconds) } }
    );
  }

  if (err instanceof AppError) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode });
  }

  if (err instanceof DomainError) {
    return NextResponse.json({ error: err.message }, { status: DOMAIN_ERROR_STATUS[err.kind] });
  }

  if (err instanceof z.ZodError) {
    return NextResponse.json(
      { error: err.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  if (err instanceof BSON.BSONError) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  console.error(`[Unhandled API Error] ${routeName}`, err);
  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}
