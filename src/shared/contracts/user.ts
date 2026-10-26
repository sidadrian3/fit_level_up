import { z } from "zod";
import { isValidTimeZone } from "@/shared/time/calendar";

export const timeZoneSchema = z.string().min(1).max(64).refine(isValidTimeZone, "Invalid time zone");

export interface User {
    id: string;
    email: string;
    name: string;
    avatar: string;
    level: number;
    xp: number;
    xpToNextLevel: number;
    streak: number;
    totalWorkouts: number;
    totalDistance: number; //km
    /** `joinDate` and `lastActivityDate` are date-only; `lastStaminaUpdate` is a full instant */
    joinDate: string;
    lastActivityDate?: string;
    stamina: number;
    lastStaminaUpdate: string;
    timeZone: string;
}
