import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { questKeys } from "@/lib/quests/keys";
import { statsKeys } from "@/lib/stats/keys";
import { progressionKeys } from "../keys";

// Every activity change moves XP, streak and stamina, quest progress and personal records.
export function invalidateActivityChange(queryClient: QueryClient, activityKey: QueryKey) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: activityKey }),
    queryClient.invalidateQueries({ queryKey: progressionKeys.all }),
    queryClient.invalidateQueries({ queryKey: questKeys.all }),
    queryClient.invalidateQueries({ queryKey: statsKeys.all }),
  ]);
}
