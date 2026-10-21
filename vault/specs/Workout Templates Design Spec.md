## Problem Statement
Users frequently repeat the same workout routines (e.g., "Push Day", "Leg Day"). Logging these workouts from scratch every time by manually adding the same exercises, sets, reps, and weights is tedious and creates friction in the app experience.

## Solution
Introduce "Workout Templates", allowing users to build and save predefined workout routines with full exercise details. Users can then select "Start from Template" when logging a workout to instantly pre-fill the form with their saved routine, minimizing data entry.

## User Stories
1. As an active user, I want to create a new workout template with a custom name so that I can organize my routines.
2. As an active user, I want to add multiple exercises to a template, including target sets, reps, and weights, so that my routine is fully defined.
3. As an active user, I want to view a list of all my saved templates so that I can easily find the one I want to do today.
4. As an active user, I want to click "Start from Template" on the workout screen so that the form is instantly populated with my saved routine.
5. As an active user, I want to edit a template's name or exercises so that I can evolve my routine over time.
6. As an active user, I want to delete a template I no longer use so that my template list stays organized.
7. As an active user, I want to adjust the pre-filled sets/reps/weights in the workout form after loading a template so that I can record my actual performance for that day without altering the base template.

## Implementation Decisions
- **Data Model:** A dedicated `workoutTemplatesCollection` in MongoDB. This mirrors the `customExercisesCollection` and keeps the `User` document lightweight.
- **Data Shape:** The template will store the full `Exercise` object (name, targetMuscle, sets, reps, weight) as static defaults.
- **UX - Creation:** A dedicated Template Builder UI (`/templates/new`), separate from past workouts, but reusing similar components to the `WorkoutForm`.
- **UX - Consumption:** A "Start from Template" modal/drawer injected into the existing `WorkoutForm`.

## Testing Decisions
- **Domain/Data Layer:** Test the data mappers (`workout-templates-db.ts`) and ensure CRUD operations work correctly against the in-memory MongoDB in Vitest.
- **Service Layer:** Test that `createWorkoutTemplate` and `deleteWorkoutTemplate` enforce authorization (users can only touch their own templates).
- **Idempotency:** Verify that rapid-fire template creation with the same idempotency key does not create duplicates.
