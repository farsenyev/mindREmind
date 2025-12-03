import { Telegraf } from "telegraf";
import { Markup } from "telegraf";
import { parseEventInput } from "../utils/parserEventInput";
import {
    createEvent,
    formatEventForMessage, getEventById,
    updateRsvp,
} from "../services/eventService";
import { getUserByUsername } from "../services/userService";
import { EventItem } from "../types/event";

export function registerEventCommand(bot: Telegraf) {
    bot.command("event", async (ctx) => {
        const messageText = ctx.message?.text || "";
        const args = messageText.replace(/^\/event(@\w+)?\s*/i, "");

        if (!args) {
            ctx.reply(
                "Формат:\n" +
                "/event 10m @user созвон\n" +
                "/event 2h @user1 @user2 встреча\n" +
                "/event 2025-12-10 19:30 @user встреча",
            );
            return;
        }

        const parsed = parseEventInput(args);
        if (!parsed) {
            ctx.reply(
                "Не смог понять время 😔\nПримеры:\n" +
                "/event 10m @user созвон\n" +
                "/event 1d @user подготовить отчёт\n" +
                "/event 2025-12-10 19:30 @user встреча",
            );
            return;
        }

        const chatId = ctx.chat?.id;
        const creatorId = ctx.from?.id;
        if (!chatId || !creatorId) {
            ctx.reply("Не могу определить чат или пользователя 🤔");
            return;
        }

        const event = createEvent(
            chatId,
            creatorId,
            parsed.fireAt,
            parsed.title,
            parsed.usernames,
        );

        const text = formatEventForMessage(event);

        const creatorMessage = await ctx.reply(text)
        event.creatorMessageId = creatorMessage.message_id;

        for (const username of parsed.usernames) {
            const user = getUserByUsername(username);
            if (!user) continue;

            try {
                await ctx.telegram.sendMessage(
                    user.id,
                    `👋 Привет, ${user.firstName || username}!\n` +
                    `Тебя пригласили на событие:\n\n` +
                    text,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: "✅ Приду",
                                        callback_data: `event_rsvp:${event.id}:yes`,
                                    },
                                    {
                                        text: "❌ Не смогу",
                                        callback_data: `event_rsvp:${event.id}:no`,
                                    },
                                ],
                            ],
                        },
                    },
                );
            } catch (err) {
                console.error(`Не удалось отправить личное приглашение @${username}`, err);
            }
        }

        scheduleEventNotification(bot, event.id);
    });

    bot.on("callback_query", async (ctx) => {
        const cq = ctx.callbackQuery;
        if (!("data" in cq) || typeof cq.data !== "string") {
            return ctx.answerCbQuery();
        }

        const data = cq.data;
        if (!data.startsWith("event_rsvp:")) {
            return ctx.answerCbQuery();
        }

        const [, idStr, statusStr] = data.split(":");
        const eventId = Number(idStr);
        const status = statusStr === "yes" ? "yes" : "no";

        const fromUsername = ctx.from?.username;
        if (!fromUsername) {
            return ctx.answerCbQuery("Мне нужен твой username, чтобы записать ответ 🙈");
        }

        const updated = updateRsvp(eventId, fromUsername, status);
        if (!updated) {
            return ctx.answerCbQuery("Не нашла событие или тебя там нет 😅");
        }

        const newText = formatEventForMessage(updated);

        await ctx.editMessageText(newText);

        if (updated.creatorMessageId) {
            try {
                await bot.telegram.editMessageText(
                    updated.chatId,
                    updated.creatorMessageId,
                    undefined,
                    newText
                );
            } catch (err) {
                console.error("Не удалось обновить сообщение создателя события", err);
            }
        }

        await ctx.answerCbQuery("Ответ записан 👍");
    });
}

function scheduleEventNotification(bot: Telegraf, eventId: number): void {
    const event=getEventById(eventId)
    if (!event) return

    const delay = event.fireAt.getTime() - Date.now();
    if (delay <= 0) return;

    setTimeout(async () => {
        const current = getEventById(eventId);
        if (!current) return;
        const text = `🔔 Наступило время события!\n\n${formatEventForMessage(event)}`;

        try {
            await bot.telegram.sendMessage(current.chatId, text);
        } catch (err) {
            console.error("Ошибка при отправке уведомления в чат:", err);
        }

        for (const invite of current.invites) {
            const user = getUserByUsername(invite.username);
            if (!user) continue;
            if (invite.status !== "yes") continue;

            try {
                await bot.telegram.sendMessage(
                    user.id,
                    `🔔 Напоминание о событии:\n\n${formatEventForMessage(event)}`,
                );
            } catch (err) {
                console.error(
                    `Ошибка при отправке личного напоминания @${invite.username}`,
                    err,
                );
            }
        }
    }, delay);
}
