import { renameCustomExercisesMigration } from "./001-rename-custom-exercises";
import { prepareUniqueIndexesMigration } from "./002-prepare-unique-indexes";
import type { Migration } from "./run-migrations";

// The rename runs first: the dedupe in 002 targets custom_exercises, which production only has after 001.
export const MIGRATIONS: Migration[] = [renameCustomExercisesMigration, prepareUniqueIndexesMigration];

export { runMigrations, shouldRunMigrations } from "./run-migrations";
export type { Migration } from "./run-migrations";
