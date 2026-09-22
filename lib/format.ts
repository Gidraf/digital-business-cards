/** CVPAP timestamps are naive UTC ("2026-09-22T10:12:28"); treat them as UTC. */
export function parseApiDate(iso: string | null | undefined): Date | null {
    if (!iso) return null;
    const hasZone = /[zZ]|[+-]\d\d:?\d\d$/.test(iso);
    const d = new Date(hasZone ? iso : `${iso}Z`);
    return isNaN(d.getTime()) ? null : d;
}

/** Local date+time; render inside an element with `suppressHydrationWarning`
 * (server and browser time zones differ). */
export function fmtDateTime(iso: string | null | undefined): string {
    const d = parseApiDate(iso);
    return d ? d.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) : "";
}
