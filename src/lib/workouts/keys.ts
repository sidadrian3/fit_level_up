export const workoutKeys = {
  all: ["workouts"],
  list: (page: number, limit: number) => [...workoutKeys.all, "list", { page, limit }],
} as const;
