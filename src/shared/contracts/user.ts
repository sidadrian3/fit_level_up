import { z } from "zod";
import { isValidTimeZone } from "@/shared/time/calendar";

export const timeZoneSchema = z.string().min(1).max(64).refine(isValidTimeZone, "Invalid time zone");
