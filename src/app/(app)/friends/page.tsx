"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Inbox, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FriendCard } from "@/components/friends/FriendCard";
import { FriendRequestCard } from "@/components/friends/FriendRequestCard";
import { AddFriendSection } from "@/components/friends/AddFriendSection";
import { FriendProfileModal } from "@/components/friends/FriendProfileModal";
import type { FriendProfile } from "@/lib/types";
import {
  getFriends,
  getFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
} from "@/lib/data/api-client";
type Tab = "friends" | "requests" | "add";

export default function FriendsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("friends");
  const [selectedFriend, setSelectedFriend] = useState<FriendProfile | null>(null);
  const queryClient = useQueryClient();

  // Queries
  const { data: friends = [], isLoading: loadingFriends } = useQuery({
    queryKey: ["friends"],
    queryFn: getFriends,
  });

  const { data: requests = [], isLoading: loadingRequests } = useQuery({
    queryKey: ["friends", "requests"],
    queryFn: getFriendRequests,
  });

  // Mutations
  const acceptMutation = useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
    onError: (err: Error) => console.error("Failed to accept request", err),
  });

  const declineMutation = useMutation({
    mutationFn: declineFriendRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends", "requests"] });
    },
    onError: (err: Error) => console.error("Failed to decline request", err),
  });

  const removeMutation = useMutation({
    mutationFn: removeFriend,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
    onError: (err: Error) => console.error("Failed to remove friend", err),
  });

  const sendMutation = useMutation({
    mutationFn: sendFriendRequest,
  });

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <PageHeader title="Friends" subtitle="Compete and train with your squad." />

      {/* Tabs */}
      <div className="flex p-1 bg-card border border-border rounded-xl w-fit relative z-10 shadow-sm overflow-x-auto max-w-full no-scrollbar">
        <button
          onClick={() => setActiveTab("friends")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-300 whitespace-nowrap ${
            activeTab === "friends"
              ? "bg-accent-blue text-background shadow-md"
              : "text-muted hover:text-foreground"
          }`}
        >
          My Friends
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-300 whitespace-nowrap flex items-center gap-2 ${
            activeTab === "requests"
              ? "bg-accent-blue text-background shadow-md"
              : "text-muted hover:text-foreground"
          }`}
        >
          Requests
          {requests.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === "requests" ? "bg-background text-accent-blue" : "bg-accent-blue text-background"
            }`}>
              {requests.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("add")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-300 whitespace-nowrap ${
            activeTab === "add"
              ? "bg-accent-blue text-background shadow-md"
              : "text-muted hover:text-foreground"
          }`}
        >
          Add Friends
        </button>
      </div>

      {/* Content */}
      <div className="min-h-[300px]">
        {activeTab === "friends" && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            {loadingFriends ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted" size={32} /></div>
            ) : friends.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16 px-4 bg-card/30 border border-border border-dashed rounded-3xl">
                <Users size={48} className="text-muted opacity-50 mb-4" />
                <h3 className="text-lg font-bold text-foreground">No friends yet</h3>
                <p className="text-muted text-sm mt-1 mb-6 max-w-sm">
                  You haven&apos;t added anyone yet. Go to the Add Friends tab to build your squad!
                </p>
                <button 
                  onClick={() => setActiveTab("add")}
                  className="bg-accent-blue text-background px-6 py-2 rounded-xl font-bold hover:brightness-110 transition-all shadow-lg shadow-accent-blue/20"
                >
                  Find Friends
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {friends.map((friend) => (
                  <FriendCard
                    key={friend.userId}
                    friend={friend}
                    onRemove={(id) => removeMutation.mutate(id)}
                    onViewProfile={() => setSelectedFriend(friend)}
                    isRemoving={removeMutation.isPending && removeMutation.variables === friend.userId}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "requests" && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            {loadingRequests ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted" size={32} /></div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16 px-4 bg-card/30 border border-border border-dashed rounded-3xl">
                <Inbox size={48} className="text-muted opacity-50 mb-4" />
                <h3 className="text-lg font-bold text-foreground">All caught up!</h3>
                <p className="text-muted text-sm mt-1">You have no pending friend requests.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {requests.map((req) => (
                  <FriendRequestCard
                    key={req.userId}
                    request={req}
                    onAccept={(id) => acceptMutation.mutate(id)}
                    onDecline={(id) => declineMutation.mutate(id)}
                    isProcessing={
                      (acceptMutation.isPending && acceptMutation.variables === req.userId) ||
                      (declineMutation.isPending && declineMutation.variables === req.userId)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "add" && (
          <div className="animate-in slide-in-from-right-4 duration-300">
            <AddFriendSection
              onSendRequest={(id) => sendMutation.mutateAsync(id)}
              isSending={sendMutation.isPending}
            />
          </div>
        )}
      </div>

      <FriendProfileModal 
        friend={selectedFriend}
        isOpen={!!selectedFriend}
        onClose={() => setSelectedFriend(null)}
      />
    </div>
  );
}
