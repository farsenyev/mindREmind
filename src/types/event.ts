export type RsvpStatus = "yes" | "no";

export type EventInvite = {
    username: string;
    status: RsvpStatus | "pending"
}

export type EventItem = {
    id: number;
    chatId: number;
    creatorId: number;
    title: string;
    fireAt: Date;
    invites: EventInvite[];
    creatorMessageId?: number;
}