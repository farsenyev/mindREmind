import { Telegraf } from "telegraf";
import { getEventById, formatEventForMessage } from "./eventService";

const eventTimers = new Map<number, NodeJS.Timeout>();

export function scheduleEventNotification(bot: Telegraf, eventId: number): void {
    const event = getEventById(eventId);
    if (!event) return;

    const delay = event.fireAt.getTime() - Date.now();
    if (delay <= 0) return;

    const existing = eventTimers.get(eventId);
    if (existing) {
        clearTimeout(existing);
        eventTimers.delete(eventId);
    }

    const timeout = setTimeout(async () => {
        const current = getEventById(eventId);
        if (!current) {
            eventTimers.delete(eventId);
            return;
        }

        const headerText =
            "🔔 Наступило время события!\n\n" +
            formatEventForMessage(current);

        try {
            await bot.telegram.sendMessage(current.chatId, headerText);
        } catch (err) {
            console.error("Ошибка при отправке уведомления в чат:", err);
        }

        for (const invite of current.invites) {
            if (!invite.userId) continue;
            if (invite.status === "no") continue;

            if (invite.userId === current.creatorId) continue;

            try {
                await bot.telegram.sendMessage(
                    invite.userId,
                    `🔔 Напоминание о событии:\n\n${formatEventForMessage(current)}`,
                );
            } catch (err) {
                console.error(
                    `Ошибка при отправке личного напоминания userId=${invite.userId} (@${invite.username})`,
                    err,
                );
            }
        }

        eventTimers.delete(eventId);
    }, delay);

    eventTimers.set(eventId, timeout);
}
