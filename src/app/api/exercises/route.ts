import { createCustomExercise, getCustomExercises } from "@/server/training";
import { CreateCustomExerciseSchema } from "@/shared/contracts/exercise";
import { defineRoute } from "@/server/runtime";

export const GET = defineRoute({ name: "exercises.list", auth: "user" }, ({ userId }) => getCustomExercises(userId));

export const POST = defineRoute(
  { name: "exercises.create", auth: "user", throttle: "standard", body: CreateCustomExerciseSchema, status: 201 },
  ({ userId, body }) => createCustomExercise(userId, body.name, body.targetMuscle)
);
