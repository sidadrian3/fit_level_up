import { describe, it, expect } from "vitest";
import { handleApiError } from "../handle-api-error";
import { DomainError } from "@/lib/domain/domain-error";
import { ForbiddenError } from "../errors";

describe("handleApiError", () => {
  it("maps an invalid DomainError to 400 with its message", async () => {
    const response = handleApiError(new DomainError("invalid", "Quest is not completed"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Quest is not completed" });
  });

  it("maps a conflicting DomainError to 409", () => {
    expect(handleApiError(new DomainError("conflict", "Quest already claimed")).status).toBe(409);
  });

  it("maps ForbiddenError to 403", () => {
    expect(handleApiError(new ForbiddenError("Not allowed")).status).toBe(403);
  });
});
