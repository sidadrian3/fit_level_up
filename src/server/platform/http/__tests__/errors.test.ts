import { describe, it, expect, vi } from "vitest";
import { BSON } from "mongodb";
import { z } from "zod";
import { DomainError } from "@/server/platform/domain";
import { ForbiddenError, TooManyRequestsError, toErrorResponse } from "..";

describe("toErrorResponse", () => {
  it("maps an invalid DomainError to 400 with its message", async () => {
    const response = toErrorResponse(new DomainError("invalid", "Quest is not completed"), "test");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Quest is not completed" });
  });

  it("maps a conflicting DomainError to 409", () => {
    expect(toErrorResponse(new DomainError("conflict", "Quest already claimed"), "test").status).toBe(409);
  });

  it("maps ForbiddenError to 403", () => {
    expect(toErrorResponse(new ForbiddenError("Not allowed"), "test").status).toBe(403);
  });

  it("maps ZodError to 400 with the first issue message", async () => {
    const result = z.object({ name: z.string("Name is required") }).safeParse({});
    const response = toErrorResponse(result.error, "test");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Name is required" });
  });

  it("maps BSONError to 404", async () => {
    const response = toErrorResponse(new BSON.BSONError("bad id"), "test");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not Found" });
  });

  it("maps TooManyRequestsError to 429 with Retry-After", async () => {
    const response = toErrorResponse(new TooManyRequestsError(42), "test");
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(await response.json()).toEqual({ error: "Too many requests" });
  });

  it("maps unknown errors to a logged 500 without leaking internals", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = toErrorResponse(new Error("db password leaked"), "test");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal Server Error" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
