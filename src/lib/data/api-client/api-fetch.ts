export async function apiFetch<T>(
  url: string,
  options?: RequestInit,
  retries = 2,
): Promise<T> {
  try {
    const res = await fetch(url, options);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(
        typeof data.error === "string" ? data.error : `Request failed: ${url}`,
      );
    }
    return res.json();
  } catch (err) {
    const isNetworkError = err instanceof TypeError;
    const isIdempotent =
      !options?.method ||
      options.method === "GET" ||
      (typeof options.body === "string" &&
        options.body.includes("idempotencyKey"));

    if (isNetworkError && isIdempotent && retries > 0) {
      console.warn(
        `[Network Error] Retrying ${url}... (${retries} retries left)`,
      );
      // Exponential backoff could be added here
      await new Promise((res) => setTimeout(res, 1000));
      return apiFetch(url, options, retries - 1);
    }
    throw err;
  }
}
