import {Telegraf} from "telegraf";
import {clearTimeout} from "node:timers";

export type Reminder = {
    id: number;
    chatId: number;
    text: string;
    fireAt: Date;
    timeout?: NodeJS.Timeout;
};

let lastReminderId = 0;
const remindersByChat = new Map<number, Reminder[]>();
const remindersById = new Map<number, Reminder>();

export function scheduleReminder(
    bot: Telegraf,
    chatId: number,
    text: string,
    fireAt: Date
): Reminder | null {
    const delay = fireAt.getTime() - Date.now() + 500;
    if (delay <= 0) return null;

    const id = ++lastReminderId;

    const reminder: Reminder = {
        id,
        chatId,
        text,
        fireAt,
        timeout: setTimeout(() => {}, 0)
    };

    reminder.timeout = setTimeout(async () => {
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

    const list = remindersByChat.get(chatId) || [];
    list.push(reminder);
    remindersByChat.set(chatId, list);
    remindersById.set(id, reminder)

    return reminder;
}

export function getRemindersForChat(chatId: number): Reminder[] {
    return remindersByChat.get(chatId) || [];
}

export function getReminderById(id: number): Reminder | undefined {
    return remindersById.get(id);
}

export function deleteReminder(id: number): Reminder | undefined {
    const reminder = remindersById.get(id)
    if (!reminder) return

    if (reminder.timeout) {
        clearTimeout(reminder.timeout);
    }

    remindersById.delete(id)

    const list = remindersByChat.get(reminder.chatId);
    if (list) {
        remindersByChat.set(
            reminder.chatId,
            list.filter((r) => r.id !== id)
        )
    }

    return reminder;
}

export function updateReminder(
    bot: Telegraf,
    id: number,
    fireAt: Date,
    text: string,
) {
    const reminder = remindersById.get(id);
    if (!reminder) return;

    if (reminder.timeout) {
        clearTimeout(reminder.timeout);
        delete reminder.timeout;
    }

    reminder.fireAt = fireAt;
    reminder.text = text;

    const delay = fireAt.getTime() - Date.now();
    if (delay <= 5_000) {
        return reminder;
    }

    reminder.timeout = setTimeout(async () => {
        try {
            await bot.telegram.sendMessage(
                reminder.chatId,
                `⏰ Напоминание!\n${reminder.text}`,
            );
        } catch (err) {
            console.error("Не удалось отправить напоминание", err);
        } finally {
            deleteReminder(id);
        }
    }, delay);

    return reminder;
}