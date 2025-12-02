import dayjs from "dayjs";

export const parseReminder = (input: string): {fireAt: Date, text: string} | null => {
    const trimmed = input.trim()
    if (!trimmed) return null;

    const relativeMatches = trimmed.match(/^(\d+)([mhd])\s+(.+)/i);
    if (relativeMatches) {
        // @ts-ignore
        const amount = parseInt(relativeMatches[1], 10);
        const unit = relativeMatches[2];
        const text = relativeMatches[3];

        let fireMoment = dayjs();
        if (unit === "m") fireMoment = fireMoment.add(amount, "minute");
        if (unit === "h") fireMoment = fireMoment.add(amount, "hour");
        if (unit === "d") fireMoment = fireMoment.add(amount, "day");

        // @ts-ignore
        return {fireAt: fireMoment.toDate(), text};
    }

    const absMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+(.+)/);
    if (absMatch) {
        const dateTimeStr = absMatch[1];
        const text = absMatch[2];

        const fireMoment = dayjs(dateTimeStr, "YYYY-MM-DD HH:mm");
        if (!fireMoment.isValid()) return null;

        // @ts-ignore
        return { fireAt: fireMoment.toDate(), text };
    }

    return null;
}

