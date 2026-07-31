"use client";

import React from "react";
import { WorkoutTemplate } from "@/lib/types";
import { X, Trash2, Loader2, Plus, BookmarkPlus } from "lucide-react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWorkoutTemplates, deleteWorkoutTemplate } from "@/lib/data/api-client";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: WorkoutTemplate) => void;
}

export function TemplateSelectorModal({ isOpen, onClose, onSelect }: Props) {
  const queryClient = useQueryClient();
  
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["workoutTemplates"],
    queryFn: fetchWorkoutTemplates,
    enabled: isOpen
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWorkoutTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workoutTemplates"] });
    }
  });

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-card w-full max-w-md rounded-xl shadow-xl border border-border p-6 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-modal-title"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 id="template-modal-title" className="text-lg font-bold text-foreground">
            Start from Template
          </h3>
          <div className="flex items-center gap-2">
            <Link
              href="/templates/new"
              onClick={onClose}
              className="text-xs px-3 py-1.5 font-medium text-accent-green bg-accent-green/10 hover:bg-accent-green/20 rounded-lg flex items-center gap-1 transition-colors active:scale-95"
            >
              <Plus size={14} /> New
            </Link>
            <button 
              onClick={onClose} 
              className="p-2 -mr-2 text-muted hover:text-foreground hover:bg-card-hover rounded-full transition-colors"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <Loader2 className="animate-spin mb-4" size={32} />
              <p className="text-sm">Loading templates...</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-card-hover flex items-center justify-center mb-4">
                <BookmarkPlus size={24} className="text-muted opacity-50" />
              </div>
              <p className="text-foreground font-medium mb-1">No templates found</p>
              <p className="text-muted text-sm max-w-[200px] mb-6">
                Create a template to quickly pre-fill your workouts.
              </p>
              <Link
                href="/templates/new"
                onClick={onClose}
                className="px-4 py-2 bg-accent-green text-background font-medium rounded-lg hover:bg-accent-green/90 transition-colors active:scale-95 flex items-center gap-2"
              >
                <Plus size={18} />
                Create Template
              </Link>
            </div>
          ) : (
            templates.map(template => (
              <div 
                key={template.id} 
                className="group p-4 border border-border rounded-xl flex items-center justify-between hover:border-accent-green hover:bg-accent-green/5 cursor-pointer active:scale-[0.98] transition-all"
                onClick={() => {
                  onSelect(template);
                  onClose();
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(template);
                    onClose();
                  }
                }}
              >
                <div className="flex-1 min-w-0 pr-4">
                  <p className="font-semibold text-foreground truncate">{template.name}</p>
                  <p className="text-sm text-muted mt-1 truncate">
                    {template.exercises.length} exercise{template.exercises.length !== 1 ? 's' : ''} • {template.exercises.map(e => e.name).join(", ")}
                  </p>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to delete "${template.name}"?`)) {
                      deleteMutation.mutate(template.id);
                    }
                  }}
                  className="p-3 -mr-3 text-muted hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                  aria-label={`Delete ${template.name}`}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
