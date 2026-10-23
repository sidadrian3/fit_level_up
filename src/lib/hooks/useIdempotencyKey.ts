"use client";

import { useCallback, useState } from "react";

export function useIdempotencyKey() {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const rotate = useCallback(() => setKey(crypto.randomUUID()), []);
  return { key, rotate };
}
