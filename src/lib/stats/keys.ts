export const statsKeys = {
  all: ["stats"],
  personalRecords: () => [...statsKeys.all, "personal-records"],
} as const;
