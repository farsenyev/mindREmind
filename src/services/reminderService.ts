import { Telegraf } from "telegraf";
import dayjs from "dayjs";
import { Reminder } from "../types/reminder";

let lastReminderId = 0;
const reminderByChat = new Map<number, Reminder[]>()

export const sheduleReminder = (
    bot: Telegraf,
    chatId: number,
    text: string,
    fireAt: Date,
): Reminder | null => {
    const delay = fireAt.getTime() - Date.now();
    if (delay <= 0) return null;

    const id = ++lastReminderId;

    const timeout = setTimeout(async () => {
        try{
            await bot.telegram.sendMessage(chatId, `Напоминание: ${text}`)
        } catch (err) {
            console.error("Error sending reminder:", err);
        }

        const list = reminderByChat.get(chatId) || [];
        const filtered = list.filter((r) => r.id === id);
        reminderByChat.set(chatId, filtered);
    }, delay)

    const reminder: Reminder = {id, chatId, text, fireAt, timeout}

    const list = reminderByChat.get(chatId) || []
    list.push(reminder)
    reminderByChat.set(chatId, list)

    return reminder;
}

export const getReminderForChat = (chatId: number): Reminder[] => {
    return reminderByChat.get(chatId) || [];
}

export const formatReminderList = (reminders: Reminder[]): string => {
    if (reminders.length === 0) return "У тебя пока нет активных напоминаний";

    const lines = reminders.map((r) => {
        const when = dayjs(r.fireAt).format("YYYY-MM-DD HH:mm")
        return `#${r.id} — ${when} — ${r.text}`;
    })

    return "Твои активные напоминания:\n" + lines.join("\n");
}