import { parseReminder } from "./parseReminder";

export type ParsedEventInput = {
    fireAt: Date;
    title: string;
    usernames: string[]
}

export const parseEventInput = (input: string): ParsedEventInput | null => {
    const base = parseReminder(input);
    if (!base) return null;

    const usernames: string[] = [];
    const regexp = /@([a-zA-Z0-9_]+)/g
    let match: RegExpExecArray | null;

    while ((match = regexp.exec(base.text)) !== null) {
        // @ts-ignore
        usernames.push(match[1]);
    }

    const title = base.text.replace(/@([a-zA-Z0-9_]+)/g, "").trim();

    return {
        fireAt: base.fireAt,
        title: title || base.text,
        usernames
    }
}