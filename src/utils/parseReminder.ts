import dayjs from "dayjs";

export type ParsedReminderInput = {
    fireAt: Date,
    text: string;
}

export const parseReminder = (input: string): ParsedReminderInput | null => {
    const trimmed = input.trim()
    if (!trimmed) return null;

    const relMatch = /^(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks)\s+(.+)$/i.exec(
        trimmed,
    );
    if (relMatch) {
        const amount = Number(relMatch[1]);
        const unitRaw = relMatch[2]?.toLowerCase();
        const text = relMatch[3]?.toString();

        if (!unitRaw || !text) return null

        if (!Number.isFinite(amount) || !text) return null;

        let unit: dayjs.ManipulateType;
        if (unitRaw.startsWith("s")) unit = "second";
        else if (unitRaw.startsWith("m")) unit = "minute";
        else if (unitRaw.startsWith("h")) unit = "hour";
        else if (unitRaw.startsWith("d")) unit = "day";
        else unit = "week";

        const fireAt = dayjs().add(amount, unit);
        if (!fireAt.isValid()) return null;

        return {
            fireAt: fireAt.toDate(),
            text
        };
    }

    const absMatch = /^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})\s+(.+)$/.exec(trimmed);
    if (absMatch) {
        const datePart = absMatch[1];
        const timePart = absMatch[2];
        const text = absMatch[3];

        const fireAt = dayjs(`${datePart} ${timePart}`, "YYYY-MM-DD HH:mm");
        if (!fireAt.isValid()) return null;

        if (!text) return null;

        return {
            fireAt: fireAt.toDate(),
            text
        };
    }

    return null;
}

