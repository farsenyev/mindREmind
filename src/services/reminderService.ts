import { Telegraf } from "telegraf";

export type Reminder = {
    id: number;
    chatId: number;
    text: string;
    fireAt: Date;
    timeout: NodeJS.Timeout;
};

let lastReminderId = 0;
const remindersByChat = new Map<number, Reminder[]>();

export function scheduleReminder(
    bot: Telegraf,
    chatId: number,
    text: string,
    fireAt: Date
): Reminder | null {
    const delay = fireAt.getTime() - Date.now();
    if (delay <= 0) return null;

    const id = ++lastReminderId;

    const reminder: Reminder = {
        id,
        chatId,
        text,
        fireAt,
        timeout: setTimeout(() => {}, 0)
    };

    const timeout = setTimeout(async () => {
        try {
            await bot.telegram.sendMessage(
                reminder.chatId,
                `🔔 Напоминание: ${reminder.text}`
            );
        } catch (err) {
            console.error("Error sending reminder:", err);
        }

        const list = remindersByChat.get(reminder.chatId) || [];
        const filtered = list.filter((r) => r.id !== reminder.id);
        remindersByChat.set(reminder.chatId, filtered);
    }, delay);

    reminder.timeout = timeout;

    const list = remindersByChat.get(chatId) || [];
    list.push(reminder);
    remindersByChat.set(chatId, list);

    return reminder;
}

export function getRemindersForChat(chatId: number): Reminder[] {
    return remindersByChat.get(chatId) || [];
}
