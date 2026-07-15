"use client";

import { useState } from "react";
import { Copy, UserPlus, CheckCircle2, Loader2 } from "lucide-react";
import { useUser } from "@/lib/context/UserContext";
import { Friendship } from "@/lib/types";

interface AddFriendSectionProps {
  onSendRequest: (id: string) => Promise<Friendship>;
  isSending?: boolean;
}

export function AddFriendSection({ onSendRequest, isSending }: AddFriendSectionProps) {
  const { user } = useUser();
  const [friendId, setFriendId] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const handleCopy = async () => {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(user.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendId.trim()) return;
    if (friendId.trim() === user?.id) {
      setError("You cannot add yourself.");
      return;
    }
    setError("");
    try {
      await onSendRequest(friendId.trim());
      setFriendId(""); // clear on success
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send request.");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Share ID Card */}
      <div className="bg-card/60 border border-border backdrop-blur-md p-6 rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
        <div className="bg-accent-purple/10 p-3 rounded-full">
          <UserPlus className="text-accent-purple" size={32} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Build Your Squad</h2>
          <p className="text-muted text-sm max-w-sm mt-1">
            Share your unique User ID with friends so they can send you a request!
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-background/50 border border-border px-4 py-3 rounded-xl w-full max-w-sm overflow-hidden">
          <span className="text-sm font-mono text-foreground truncate flex-1 opacity-80">
            {user?.id || "Loading..."}
          </span>
          <button
            onClick={handleCopy}
            className="text-muted hover:text-accent-blue transition-colors flex items-center gap-1 bg-card hover:bg-card-hover px-3 py-1.5 rounded-lg border border-border"
          >
            {copied ? <CheckCircle2 size={16} className="text-accent-green" /> : <Copy size={16} />}
            <span className="text-xs font-semibold">{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 py-2">
        <div className="h-px bg-border flex-1"></div>
        <span className="text-muted text-xs font-bold uppercase tracking-widest">OR ADD SOMEONE</span>
        <div className="h-px bg-border flex-1"></div>
      </div>

      {/* Add Friend Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="friendId" className="text-sm font-semibold text-foreground ml-1">
            Friend&apos;s User ID
          </label>
          <div className="flex gap-2">
            <input
              id="friendId"
              type="text"
              value={friendId}
              onChange={(e) => {
                setFriendId(e.target.value);
                if (error) setError("");
              }}
              placeholder="Paste their ID here..."
              className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue/50 transition-shadow"
            />
            <button
              type="submit"
              disabled={!friendId.trim() || isSending}
              className="bg-accent-blue hover:brightness-110 text-background font-bold px-6 py-3 rounded-xl transition-all duration-200 shadow-lg shadow-accent-blue/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
            >
              {isSending ? <Loader2 size={20} className="animate-spin" /> : "Send Request"}
            </button>
          </div>
          {error && <p className="text-red-400 text-sm font-medium ml-1 mt-1">{error}</p>}
        </div>
      </form>

    </div>
  );
}
