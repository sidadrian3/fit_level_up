import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, isIdempotencyKeyReused } from "../api-fetch";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiFetch", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends the Idempotency-Key header from the option", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: "1" }));

    await apiFetch("/api/x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      idempotencyKey: "key-1",
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get("Idempotency-Key")).toBe("key-1");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("retries a POST that carries an idempotency key on a network error", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(jsonResponse(201, { id: "1" }));

    const promise = apiFetch<{ id: string }>("/api/x", {
      method: "POST",
      body: "{}",
      idempotencyKey: "key-1",
    });
    await vi.advanceTimersByTimeAsync(1000);

    await expect(promise).resolves.toEqual({ id: "1" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a PUT without a key", async () => {
    fetchMock.mockRejectedValue(new TypeError("network"));

    await expect(
      apiFetch("/api/x/1", { method: "PUT", body: "{}" }),
    ).rejects.toBeInstanceOf(TypeError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a POST whose body contains the text idempotencyKey", async () => {
    fetchMock.mockRejectedValue(new TypeError("network"));

    await expect(
      apiFetch("/api/x", {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: "x" }),
      }),
    ).rejects.toBeInstanceOf(TypeError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still retries a GET", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const promise = apiFetch<{ ok: boolean }>("/api/x");
    await vi.advanceTimersByTimeAsync(1000);

    await expect(promise).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws ApiError with the status on a non-2xx response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(422, { error: "msg" }));

    const err: unknown = await apiFetch("/api/x", { method: "POST" }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(422);
    expect((err as ApiError).message).toBe("msg");
  });
});

describe("isIdempotencyKeyReused", () => {
  it("is true only for a 422 ApiError", () => {
    expect(isIdempotencyKeyReused(new ApiError(422, "reused"))).toBe(true);
    expect(isIdempotencyKeyReused(new ApiError(409, "conflict"))).toBe(false);
    expect(isIdempotencyKeyReused(new Error("reused"))).toBe(false);
  });
});
