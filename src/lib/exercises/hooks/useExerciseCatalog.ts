"use client";

import { useMemo } from "react";
import { PREDEFINED_EXERCISES } from "@/lib/constants/exercises";
import { mergeAndSortExercises } from "@/shared/exercise-list";
import { TargetMuscle } from "@/shared/contracts/exercise";
import { useCreateCustomExercise } from "./useCreateCustomExercise";
import { useCustomExercises } from "./useCustomExercises";

const OTHER_GROUP = "Other";

export function useExerciseCatalog() {
  const { data: customExercises = [] } = useCustomExercises();
  const { mutateAsync: createCustomExercise } = useCreateCustomExercise();

  const exercises = useMemo(
    () => mergeAndSortExercises(PREDEFINED_EXERCISES, customExercises),
    [customExercises],
  );

  const exerciseGroups = useMemo(() => {
    const groups: Record<string, typeof exercises> = {};
    Object.values(TargetMuscle).forEach((muscle) => (groups[muscle] = []));
    groups[OTHER_GROUP] = [];
    exercises.forEach((exercise) => {
      const groupKey = groups[exercise.targetMuscle] ? exercise.targetMuscle : OTHER_GROUP;
      groups[groupKey].push(exercise);
    });
    return groups;
  }, [exercises]);

  const findExercise = (name: string) => exercises.find((exercise) => exercise.name === name);

  return { exercises, exerciseGroups, findExercise, createCustomExercise };
}
