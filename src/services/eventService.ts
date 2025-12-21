import dayjs from "dayjs";
import { EventItem, RsvpStatus } from "../types/event";

let lastEventId = 0;
const eventsByChat = new Map<number, EventItem[]>();
const eventsById = new Map<number, EventItem>();

export const createEvent = (
    chatId: number,
    creatorId: number,
    fireAt: Date,
    title: string,
    usernames: string[],
): EventItem => {
    const id = ++lastEventId;

    const invites = usernames.map((u) => ({
        username: u,
        status: "pending" as const,
    }));

    const event: EventItem = {
        id,
        chatId,
        creatorId,
        fireAt,
        title,
        invites,
    };

    eventsById.set(id, event);

    const list = eventsByChat.get(chatId) || [];
    list.push(event);
    eventsByChat.set(chatId, list);

    return event;
};

export const deleteEvent= (eventId: number): EventItem | undefined => {
    const event = eventsById.get(eventId);
    if (!event) return

    eventsById.delete(eventId);

    const list = eventsByChat.get(event.chatId) || [];
    const filtered =list.filter((e) => e.id !== eventId);
    eventsByChat.set(event.chatId, filtered);

    return event;
}

export const getEventsForChat = (chatId: number): EventItem[] => {
    return eventsByChat.get(chatId) || [];
};

export const getEventById = (eventId: number): EventItem | undefined => {
    return eventsById.get(eventId);
};

export const updateRsvp = (
    eventId: number,
    username: string,
    userId: number,
    status: RsvpStatus,
): EventItem | undefined => {
    const event = eventsById.get(eventId);
    if (!event) return;

    let invite = event.invites.find(
        (i) => i.userId !== undefined && i.userId === userId,
    );
    if (!invite && username) {
        invite = event.invites.find(
            (i) => i.username.toLowerCase() === username.toLowerCase(),
        );
    }

    if (!invite) {
        if (!username) return
        invite = {
            username,
            userId,
            status
        };

        event.invites.push(invite);
    } else {
        invite.status = status;
        if (!invite.userId) invite.userId = userId;
    }

    return event;
};

export const formatEventForMessage = (event: EventItem): string => {
    const dateStr = dayjs(event.fireAt).format("YYYY-MM-DD HH:mm");

    const invitesStr =
        event.invites.length === 0
            ? "Без приглашенных"
            : event.invites
                .map((i) => {
                    const emoji =
                        i.status === "yes"
                            ? "✅"
                            : i.status === "no"
                                ? "❌"
                                : "⏳";
                    return `${emoji} @${i.username}`;
                })
                .join("\n");

    return (
        `📅 Событие #${event.id}\n` +
        `Дата/время: ${dateStr}\n` +
        `Описание: ${event.title}\n\n` +
        `Участники:\n${invitesStr}`
    );
};

export const getEventsForUsers = (
    userId: number,
    username?: string
): EventItem[] => {
    const all = Array.from(eventsById.values());

    return all.filter((event) => {
        const isCreator = event.creatorId === userId

        const isInvited = !!username && event.invites.some((i) => i.username.toLowerCase() === username.toLowerCase());

        return isCreator || isInvited;
    });
}
