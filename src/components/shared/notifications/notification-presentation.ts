import {
  ArrowUp,
  Trophy,
  UserCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { AchievementIconMap } from "@/lib/constants/achievement-icons";
import { ACHIEVEMENT_DEFINITIONS } from "@/shared/achievement-definitions";
import type { Notification } from "@/shared/contracts/notification";

type NotificationPresentation = {
  text: string;
  Icon: LucideIcon;
  chipClass: string;
  href: "/friends" | "/profile";
};

const CHIP_BLUE = "bg-accent-blue/15 text-accent-blue";
const CHIP_GREEN = "bg-accent-green/15 text-accent-green";
const CHIP_PURPLE = "bg-accent-purple/15 text-accent-purple";

export function describeNotification(
  notification: Notification,
): NotificationPresentation {
  const name = notification.actor?.name ?? "Someone";

  switch (notification.type) {
    case "friend.requested":
      return {
        text: `${name} sent you a friend request`,
        Icon: UserPlus,
        chipClass: CHIP_BLUE,
        href: "/friends",
      };
    case "friend.accepted":
      return {
        text: `${name} accepted your friend request`,
        Icon: UserCheck,
        chipClass: CHIP_GREEN,
        href: "/friends",
      };
    case "friend.leveled-up":
      return {
        text: `${name} reached Level ${notification.data.newLevel}`,
        Icon: ArrowUp,
        chipClass: CHIP_PURPLE,
        href: "/friends",
      };
    case "achievement.unlocked": {
      const definition = ACHIEVEMENT_DEFINITIONS.find(
        (candidate) => candidate.id === notification.data.achievementId,
      );
      return {
        text: definition
          ? `Achievement unlocked: ${definition.title}`
          : "Achievement unlocked",
        Icon: (definition && AchievementIconMap[definition.icon]) || Trophy,
        chipClass: CHIP_PURPLE,
        href: "/profile",
      };
    }
  }
}

export function formatRelativeTime(isoInstant: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - Date.parse(isoInstant)) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
