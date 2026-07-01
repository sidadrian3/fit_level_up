

export async function apiFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, options);

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      typeof data.error === "string" ? data.error : `Request failed: ${url}`,
    );
  }

  return res.json();
}

export async function apiFetchAndNotify<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const result = await apiFetch<T>(url, options);
  window.dispatchEvent(new Event("user-updated"));
  return result;
}
