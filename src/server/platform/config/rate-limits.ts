export const RATE_LIMIT_TIERS = {
  standard: { requests: 30, window: "1 m" },
  expensive: { requests: 10, window: "1 h" },
} as const;
