export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const UNPROCESSABLE_ENTITY = 422;

/** The server refuses an Idempotency-Key that was already used with a different body. */
export function isIdempotencyKeyReused(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === UNPROCESSABLE_ENTITY;
}

const SAFE_METHODS = ["GET", "HEAD"];

export async function apiFetch<T>(
  url: string,
  options?: RequestInit & { idempotencyKey?: string },
  retries = 2,
): Promise<T> {
  const { idempotencyKey, ...rest } = options ?? {};
  const headers = new Headers(rest.headers);
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);

  try {
    const res = await fetch(url, { ...rest, headers });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError(
        res.status,
        typeof data.error === "string" ? data.error : `Request failed: ${url}`,
      );
    }
    return res.json();
  } catch (err) {
    const isNetworkError = err instanceof TypeError;
    const isRetrySafe =
      !rest.method ||
      SAFE_METHODS.includes(rest.method) ||
      headers.has("Idempotency-Key");

    if (isNetworkError && isRetrySafe && retries > 0) {
      console.warn(
        `[Network Error] Retrying ${url}... (${retries} retries left)`,
      );
      await new Promise((res) => setTimeout(res, 1000));
      return apiFetch(url, options, retries - 1);
    }
    throw err;
  }
}
