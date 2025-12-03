import { Telegraf } from "telegraf";
import dayjs from "dayjs";
import { getEventsForUsers } from "../services/eventService";
import { getRemindersForChat } from "../services/reminderService";

export const registerListCommand = (bot: Telegraf) => {
    bot.command("list", async (ctx) => {
        if (!ctx.from) {
            ctx.reply("Не могу определить пользователя 🤔");
            return;
        }

        const userId = ctx.from.id
        const username = ctx.from.username
        const chatId = ctx.chat.id

        const now = Date.now();
        const events = getEventsForUsers(userId, username).filter((r) => r.fireAt.getTime() > now);
        const reminders = getRemindersForChat(chatId).filter((r) => r.fireAt.getTime() > now);

        let parts: string[] = []

        if (events.length > 0) {
            const sortedEvents = [...events].sort(
                (a, b) => a.fireAt.getTime() - b.fireAt.getTime()
            );

            const eventLines = sortedEvents.map((event) => {
                const when = dayjs(event.fireAt).format("YYYY-MM-DD HH:mm");
                const role = event.creatorId === userId ? "создатель" : "участник";

                let statusLabel = "";
                if (role === "участник" && username) {
                    const invite = event.invites.find(
                        (i) => i.username.toLowerCase() === username.toLowerCase()
                    );
                    if (invite) {
                        if (invite.status === "yes") statusLabel = " — ✅ приду";
                        else if (invite.status === "no") statusLabel = " — ❌ не приду";
                        else statusLabel = " — ⏳ не ответил(а)";
                    }
                }

                return `#${event.id} — ${when}\n${event.title}\nРоль: ${role}${statusLabel}`;
            });

            parts.push("📅 *Твои события:*\n\n" + eventLines.join("\n\n"));
        } else {
            parts.push("Еще нет созданных событий")
        }
        if (reminders.length > 0) {
            const sortedReminders = [...reminders].sort(
                (a, b) => a.fireAt.getTime() - b.fireAt.getTime()
            );

            const reminderLines = sortedReminders.map((r) => {
                const when = dayjs(r.fireAt).format("YYYY-MM-DD HH:mm");
                return `#R${r.id} — ${when}\n${r.text}`;
            });

            parts.push("⏰ *Твои напоминания в этом чате:*\n\n" + reminderLines.join("\n\n"));
        } else {
            parts.push("Еще нет созданных напоминаний")
        }

        await ctx.reply(parts.join("\n\n"), {parse_mode: "Markdown"});
    })
}