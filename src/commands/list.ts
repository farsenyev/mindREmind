import { Telegraf, Context } from "telegraf";
import dayjs from "dayjs";
import { getEventsForUsers } from "../services/eventService";
import { getRemindersForChat } from "../services/reminderService";

export async function handleList(ctx: Context) {
    if (!ctx.from || !ctx.chat) {
        await ctx.reply("Не могу определить пользователя или чат 🤔");
        return;
    }

    const userId = ctx.from.id
    const username = ctx.from.username
    const chatId = ctx.chat.id
    const now = Date.now()

    const events = getEventsForUsers(userId, username).filter((e) => e.fireAt.getTime() > now);
    const reminders = getRemindersForChat(chatId).filter((r) => r.fireAt.getTime() > now);

    await ctx.reply(
        `📋 Активные объекты:\n` +
        `• События: ${events.length}\n` +
        `• Напоминания: ${reminders.length}`,
    )

    for (const event of events) {
        const when = dayjs(event.fireAt).format("YYYY-MM-DD HH:mm");
        const role = event.creatorId === userId ? "создатель" : "участник";

        const summary =
            `📅 Событие #${event.id}\n` +
            `Когда: ${when}\n` +
            `Тема: ${event.title}\n` +
            `Роль: ${role}`;

        await ctx.reply(summary, {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "🔍 Открыть",
                            callback_data: `event_view:${event.id}`,
                        },
                    ],
                ],
            },
        })
    }

    for (const reminder of reminders) {
        const when = dayjs(reminder.fireAt).format("YYYY-MM-DD HH:mm");

        const summary =
            `📅 Напоминание #${reminder.id}\n` +
            `Когда: ${when}\n` +
            `Тема: ${reminder.text}\n`

        await ctx.reply(summary, {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "🔍 Открыть",
                            callback_data: `rem_view:${reminder.id}`,
                        },
                    ],
                ],
            },
        })
    }
}

export const registerListCommand = (bot: Telegraf) => {
    bot.command("list", handleList)
}