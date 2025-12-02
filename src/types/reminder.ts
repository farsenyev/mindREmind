export type Reminder = {
    id: number;
    chatId: number;
    text: string;
    fireAt: Date;
    timeout: NodeJS.Timeout;
}
