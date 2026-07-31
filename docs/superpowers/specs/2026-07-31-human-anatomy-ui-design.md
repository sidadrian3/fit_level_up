# Interactive Human Anatomy UI - Design Spec

## 1. Goal and Purpose
Implement an interactive, visual representation of the human muscular system mapping to the `TargetMuscle` enum. This gamifies the workout experience by providing immediate visual feedback during workouts and tracking recovery/volume over time.

## 2. Design System & Aesthetics (UI-UX-Pro-Max)
- **Theme**: Dark Mode (OLED) - Deep blacks (`#020617`, `#0F172A`) with high-contrast glowing accents.
- **Typography**: `Barlow Condensed` for labels, athletic and energetic.
- **Visual Effects**: 
  - Minimal glow (`text-shadow: 0 0 10px`, `drop-shadow` on SVGs) for "pumped" or active muscles.
  - Smooth transitions (300ms `ease-in-out`) for color shifts.
- **Color Scale (Heatmap / Recovery)**:
  - **Exhausted / High Volume (Active)**: Neon Red (`#EF4444`) with glow.
  - **Recovering / Medium Volume**: Amber/Orange (`#F59E0B`).
  - **Recovered / Low Volume**: Neon Green (`#22C55E`).
  - **Inactive / Baseline**: Muted Blue/Slate (`#1E293B` or `#334155`).

## 3. Core Architecture: Inline SVG Component
We will build a single, highly controllable React component: `<AnatomyModel />`.
- **Implementation**: An inline SVG containing `<path>` elements for each major muscle group.
- **Mapping**: Each path will have an `id` or `data-muscle` attribute mapping directly to the `TargetMuscle` enum (`Chest`, `Back`, `Legs`, `Arms`, `Core`).
- **Handling Non-Muscles**: 
  - `Cardio`: Represented as a glowing heart icon in the center of the chest or an aura around the body.
  - `FullBody`: Triggers an overarching aura or simultaneous glow of all muscle groups.
- **State Injection**: The component accepts a dictionary of muscle states, determining the fill color and glow intensity of each SVG path.

```tsx
// Proposed Interface
type MuscleIntensity = "inactive" | "low" | "medium" | "high";

interface AnatomyModelProps {
  frontIntensities: Record<TargetMuscle, MuscleIntensity>;
  backIntensities: Record<TargetMuscle, MuscleIntensity>;
  view: "front" | "back" | "both"; // Determines which SVG to render
}
```

## 4. Contextual Behaviors

### A. The 7-Day Heatmap (Dashboard)
- **Data Source**: Aggregates `Workout[]` from the past 7 days.
- **Logic**: Calculates total sets/reps or XP per `TargetMuscle`. Maps the volume to the `MuscleIntensity` scale.
- **Visuals**: A static but glowing representation showing where the user has focused their training.

### B. Live Session "Pump" Tracker (Workout View)
- **Data Source**: The active workout session state (Zustand or React Context).
- **Logic**: As the user adds an `Exercise` (e.g., Bench Press -> `Chest`), the `Chest` intensity immediately spikes to "high".
- **Visuals**: Employs a pulsing CSS animation (`animate-pulse` or custom keyframes) to indicate an active "pump".

### C. Recovery Monitor (Profile/Dashboard)
- **Data Source**: Historical workouts, computing time elapsed since a muscle was last trained.
- **Logic**:
  - < 24 hours: Red (Exhausted)
  - 24 - 48 hours: Orange (Recovering)
  - > 72 hours: Green (Fully Recovered / Ready)
- **Visuals**: Smooth gradient colors based on the exact timestamp, allowing users to visually see their recovery progress.

## 5. Implementation Steps
1. **SVG Sourcing & Prep**: Acquire a clean, minimalist vector of human anatomy (front and back). Group and name paths strictly according to `TargetMuscle`.
2. **Component Scaffold**: Create the `<AnatomyModel />` in `src/components/ui/`.
3. **Domain Evaluators**: Create pure functions in `src/lib/domain/` to calculate:
   - `calcMuscleVolume(workouts, days)` -> Heatmap data.
   - `calcMuscleRecovery(workouts, now)` -> Recovery data.
4. **Integration**: Embed the component into the Dashboard and Workout entry forms.

## 6. Open Questions / Grilling
*I need your input on the following to finalize the plan:*

1. **SVG Views**: Do we want the UI to automatically flip between Front and Back views on a timer, or should the user toggle it manually with a button?
2. **"Cardio" & "Full Body"**: Do you agree with the "Aura" approach for these non-muscle targets, or would you prefer a different visual indicator (like a separate stat bar)?
3. **Animations**: Should the "Live Pump" tracker use a heartbeat/pulse animation, or a steady bright glow?
