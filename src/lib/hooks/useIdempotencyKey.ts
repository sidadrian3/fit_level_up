"use client";

import { useState } from "react";

export function useIdempotencyKey() {
  const [key, setKey] = useState(() => crypto.randomUUID());
  return { key, rotate: () => setKey(crypto.randomUUID()) };
}
