export const OUTBOX_TUNING = {
    leaseMs: 2 * 60_000,
    maxAttempts: 8,
    backoffBaseMs: 60_000,
    backoffCapMs: 6 * 3_600_000,
    overduePerRequest: 3,
    cronBudgetMs: 240_000,
} as const;
