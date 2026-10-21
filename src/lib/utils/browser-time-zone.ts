import { isValidTimeZone } from "@/lib/utils/dates";

export function getBrowserTimeZone(): string | undefined {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(timeZone) ? timeZone : undefined;
}
