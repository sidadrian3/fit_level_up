"use client";
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnatomyModel } from "../ui/AnatomyModel";
import { calcMuscleVolume } from "@/lib/domain/muscle-evaluator";

import { getWorkouts } from "@/lib/data/api-client";

export function MuscleHeatmap() {
  const [view, setView] = useState<"front" | "back">("front");

  const { data, isLoading, error } = useQuery({
    queryKey: ["workouts", { page: 1, limit: 30 }],
    queryFn: () => getWorkouts(1, 30),
  });

  if (isLoading || !data) {
    return <div className="animate-pulse bg-slate-800 border border-slate-700 rounded-xl h-[400px] w-full"></div>;
  }

  if (error) {
    return (
      <div className="bg-slate-900 border border-red-900 p-6 rounded-xl flex items-center justify-center h-[400px] w-full text-red-500">
        Failed to load heatmap data.
      </div>
    );
  }

  const intensities = calcMuscleVolume(data.data, 7);

  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col items-center w-full">
      <h3 className="text-xl font-bold font-condensed mb-4 text-slate-100 uppercase tracking-wider">7-Day Volume Heatmap</h3>
      <div className="flex gap-2 mb-6 bg-slate-800 p-1 rounded-full">
          <button 
            onClick={() => setView("front")} 
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${view === 'front' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Front
          </button>
          <button 
            onClick={() => setView("back")} 
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${view === 'back' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Back
          </button>
      </div>
      <div className="w-full">
        <AnatomyModel intensities={intensities} view={view} />
      </div>
    </div>
  );
}
