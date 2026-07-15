import { X, Dumbbell, Timer, Map, Activity } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import type { FriendProfile } from "@/lib/types";

interface FriendProfileModalProps {
  friend: FriendProfile | null;
  isOpen: boolean;
  onClose: () => void;
}

export function FriendProfileModal({ friend, isOpen, onClose }: FriendProfileModalProps) {
  if (!isOpen || !friend) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-card border border-border shadow-2xl rounded-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header/Cover Image Area (abstract gradient) */}
        <div className="h-32 bg-gradient-to-tr from-accent-purple/40 via-background to-accent-blue/20 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-background/50 hover:bg-background/80 rounded-full backdrop-blur-md transition-colors text-muted hover:text-foreground"
          >
            <X size={20} />
          </button>
        </div>

        {/* Profile Info */}
        <div className="px-6 pb-6 pt-16 relative">
          {/* Avatar pulled up into the header */}
          <div className="absolute -top-12 border-4 border-card rounded-2xl bg-card">
            <UserAvatar avatar={friend.avatar} size="lg" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground">{friend.name}</h2>
            <div className="flex items-center gap-3 mt-2 text-sm">
              <span className="bg-accent-purple/20 text-accent-purple px-3 py-1 rounded-full font-semibold border border-accent-purple/30">
                Level {friend.level}
              </span>
              <span className="text-muted font-medium flex items-center gap-1">
                 {friend.streak} Day Streak
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-card-hover rounded-2xl p-4 border border-border/50">
              <div className="text-muted text-xs font-semibold uppercase tracking-wider mb-1">Total Workouts</div>
              <div className="text-2xl font-bold text-foreground">{friend.totalWorkouts}</div>
            </div>
            <div className="bg-card-hover rounded-2xl p-4 border border-border/50">
              <div className="text-muted text-xs font-semibold uppercase tracking-wider mb-1">Total Distance</div>
              <div className="text-2xl font-bold text-foreground">{friend.totalDistance.toFixed(1)} <span className="text-sm text-muted">km</span></div>
            </div>
          </div>

          {/* Personal Records Section */}
          <div className="mt-8">
            <h3 className="text-lg font-bold text-foreground mb-4">Personal Records</h3>
            
            {friend.personalRecords && friend.personalRecords.length > 0 ? (
              <div className="space-y-3">
                {friend.personalRecords.map((record, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-card-hover border border-border/50 hover:border-border transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-background">
                        {record.type === "strength" && <Dumbbell size={18} className="text-accent-blue" />}
                        {record.type === "cardio" && <Timer size={18} className="text-accent-green" />}
                        {record.type === "endurance" && <Map size={18} className="text-orange-400" />}
                      </div>
                      <span className="font-medium text-foreground">{record.label}</span>
                    </div>
                    <span className="font-bold text-foreground">{record.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-6 bg-card-hover rounded-2xl border border-border/50 border-dashed">
                <Activity className="mx-auto text-muted/50 mb-2" size={32} />
                <p className="text-muted text-sm font-medium">No personal records yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
