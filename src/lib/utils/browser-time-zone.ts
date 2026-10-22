import { isValidTimeZone } from "@/shared/time/calendar";

export function getBrowserTimeZone(): string | undefined {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(timeZone) ? timeZone : undefined;
}
