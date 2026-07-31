"use client";
import React from "react";
import { TargetMuscle } from "@/lib/types";
import { MuscleIntensity } from "@/lib/domain/muscle-evaluator";

interface Props {
  intensities: Record<TargetMuscle, MuscleIntensity>;
  activeMuscle?: TargetMuscle | null;
  view?: "front" | "back";
}

const intensityStyles: Record<MuscleIntensity, string> = {
  inactive: "fill-slate-800 drop-shadow-none",
  low: "fill-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]",
  medium: "fill-orange-500 drop-shadow-[0_0_12px_rgba(249,115,22,0.6)]",
  high: "fill-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]",
};

export function AnatomyModel({ intensities, activeMuscle, view = "front" }: Props) {
  const getStyle = (muscle: TargetMuscle) => {
    const isLive = activeMuscle === muscle;
    const baseStyle = intensityStyles[intensities[muscle]] || intensityStyles.inactive;
    
    let style = `${baseStyle} transition-all duration-300 stroke-slate-900 stroke-[3px]`;
    if (isLive) {
      style += " animate-pulse scale-[1.02] origin-center z-10 relative";
    }
    return style;
  };

  const hasAura = activeMuscle === TargetMuscle.FullBody || intensities[TargetMuscle.FullBody] !== "inactive";
  const containerStyle = hasAura ? "filter drop-shadow-[0_0_20px_#22C55E]" : "";

  return (
    <div className={`relative w-full max-w-sm mx-auto aspect[1/2] ${containerStyle}`}>
      {/* 
        Stylized placeholder paths for the muscle groups mapping to the front/back references.
        A designer can drop in precise SVG <path> d="..." data later while keeping these IDs and classes.
      */}
      <svg viewBox="0 0 200 400" className="w-full h-full overflow-visible">
         {view === "front" ? (
             <g id="front-view">
               {/* Head/Neck (Inactive base) */}
               <path d="M85 30 C85 10, 115 10, 115 30 L110 50 L90 50 Z" className="fill-slate-700 stroke-slate-900 stroke-[3px]" />
               
               {/* Chest */}
               <path id="chest" d="M70 70 Q100 80, 130 70 L125 110 Q100 120, 75 110 Z" className={getStyle(TargetMuscle.Chest)} />
               
               {/* Core / Abs */}
               <path id="core" d="M75 115 L125 115 L115 180 Q100 190, 85 180 Z" className={getStyle(TargetMuscle.Core)} />
               
               {/* Arms (Left & Right) */}
               <path id="left-arm" d="M65 70 L40 140 L55 145 L70 100 Z" className={getStyle(TargetMuscle.Arms)} />
               <path id="right-arm" d="M135 70 L160 140 L145 145 L130 100 Z" className={getStyle(TargetMuscle.Arms)} />
               
               {/* Legs (Quads) */}
               <path id="left-leg" d="M80 185 L55 280 L75 280 L95 190 Z" className={getStyle(TargetMuscle.Legs)} />
               <path id="right-leg" d="M120 185 L145 280 L125 280 L105 190 Z" className={getStyle(TargetMuscle.Legs)} />

               {/* Cardio Aura (if active) */}
               {(activeMuscle === TargetMuscle.Cardio || intensities[TargetMuscle.Cardio] !== "inactive") && (
                 <circle cx="100" cy="95" r="15" className="fill-red-500/50 animate-ping" />
               )}
             </g>
         ) : (
             <g id="back-view">
               {/* Head/Neck (Inactive base) */}
               <path d="M85 30 C85 10, 115 10, 115 30 L110 50 L90 50 Z" className="fill-slate-700 stroke-slate-900 stroke-[3px]" />
               
               {/* Back (Lats & Traps) */}
               <path id="back" d="M60 70 L140 70 L115 160 Q100 170, 85 160 Z" className={getStyle(TargetMuscle.Back)} />
               
               {/* Arms (Triceps/Shoulders from back) */}
               <path id="left-arm-back" d="M55 70 L35 140 L50 145 L65 100 Z" className={getStyle(TargetMuscle.Arms)} />
               <path id="right-arm-back" d="M145 70 L165 140 L150 145 L135 100 Z" className={getStyle(TargetMuscle.Arms)} />
               
               {/* Legs (Hamstrings/Calves) */}
               <path id="left-leg-back" d="M85 165 L60 280 L80 280 L95 180 Z" className={getStyle(TargetMuscle.Legs)} />
               <path id="right-leg-back" d="M115 165 L140 280 L120 280 L105 180 Z" className={getStyle(TargetMuscle.Legs)} />
             </g>
         )}
      </svg>
    </div>
  );
}
