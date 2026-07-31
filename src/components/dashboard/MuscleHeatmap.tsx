"use client";
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnatomyModel } from "../ui/AnatomyModel";
import { calcMuscleVolume } from "@/lib/domain/muscle-evaluator";

import { Card } from "@/components/ui/Card";
import { getWorkouts } from "@/lib/data/api-client";

export function MuscleHeatmap() {
  const [view, setView] = useState<"front" | "back">("front");

  const { data, isLoading, error } = useQuery({
    queryKey: ["workouts", { page: 1, limit: 30 }],
    queryFn: () => getWorkouts(1, 30),
  });

  if (isLoading || !data) {
    return <Card className="animate-pulse flex items-center justify-center text-muted h-[400px] w-full">Loading...</Card>;
  }

  if (error) {
    return (
      <Card className="flex items-center justify-center h-[400px] w-full text-accent-red">
        Failed to load heatmap data.
      </Card>
    );
  }

  const intensities = calcMuscleVolume(data.data, 7);

  return (
    <Card className="flex flex-col items-center w-full p-6">
      <h3 className="text-xl font-bold font-condensed mb-4 text-foreground uppercase tracking-wider">7-Day Volume Heatmap</h3>
      <div className="flex gap-2 mb-6 bg-background p-1 rounded-full border border-border">
          <button 
            onClick={() => setView("front")} 
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-default ${view === 'front' ? 'bg-accent-green/20 text-accent-green shadow' : 'text-muted hover:text-foreground'}`}
          >
            Front
          </button>
          <button 
            onClick={() => setView("back")} 
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-default ${view === 'back' ? 'bg-accent-green/20 text-accent-green shadow' : 'text-muted hover:text-foreground'}`}
          >
            Back
          </button>
      </div>
      <div className="w-full">
        <AnatomyModel intensities={intensities} view={view} />
      </div>
    </Card>
  );
}
