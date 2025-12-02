// src/commands/event.ts
import { Telegraf } from "telegraf";
import { Markup } from "telegraf";
import { parseEventInput } from "../utils/parserEventInput";
import {
    createEvent,
    formatEventForMessage,
    updateRsvp,
} from "../services/eventService";
import { getUserByUsername } from "../services/userService";
import { EventItem } from "../types/event";

export function registerEventCommand(bot: Telegraf) {
    // /event <time> [@user1 @user2] <title>
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
                "Не смогла понять время 😔\nПримеры:\n" +
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

        // создаём событие
        const event = createEvent(
            chatId,
            creatorId,
            parsed.fireAt,
            parsed.title,
            parsed.usernames,
        );

        const text = formatEventForMessage(event);

        // клавиатура для RSVP
        const keyboard =
            parsed.usernames.length > 0
                ? Markup.inlineKeyboard([
                    [
                        Markup.button.callback(
                            "✅ Приду",
                            `event_rsvp:${event.id}:yes`,
                        ),
                        Markup.button.callback(
                            "❌ Не смогу",
                            `event_rsvp:${event.id}:no`,
                        ),
                    ],
                ])
                : undefined;

        const mentionPart =
            parsed.usernames.length > 0
                ? parsed.usernames.map((u) => `@${u}`).join(" ") + "\n\n"
                : "";

        // 1) Сообщение в чат, где создаётся событие
        if (keyboard) {
            await ctx.reply(mentionPart + text, keyboard);
        } else {
            await ctx.reply(mentionPart + text);
        }

        // 2) Личные приглашения сразу при создании
        for (const username of parsed.usernames) {
            const user = getUserByUsername(username);
            if (!user) continue; // этот пользователь ещё не нажимал /start в личке

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

        // 3) Планируем уведомление по времени события
        scheduleEventNotification(bot, event);
    });

    // обработка нажатий на кнопки RSVP
    bot.on("callback_query", async (ctx) => {
        const cq = ctx.callbackQuery;
        if (!("data" in cq) || typeof cq.data !== "string") {
            return ctx.answerCbQuery();
        }

        const data = cq.data; // "event_rsvp:2:yes"
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

        // обновляем именно то сообщение, в котором человек нажал кнопку
        await ctx.editMessageText(newText, {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "✅ Приду",
                            callback_data: `event_rsvp:${updated.id}:yes`,
                        },
                        {
                            text: "❌ Не смогу",
                            callback_data: `event_rsvp:${updated.id}:no`,
                        },
                    ],
                ],
            },
        });

        await ctx.answerCbQuery("Ответ записан 👍");
    });
}

// локальный планировщик уведомления по событию
function scheduleEventNotification(bot: Telegraf, event: EventItem): void {
    const delay = event.fireAt.getTime() - Date.now();
    if (delay <= 0) return;

    setTimeout(async () => {
        const text = `🔔 Наступило время события!\n\n${formatEventForMessage(event)}`;

        try {
            // уведомление в чат, где создали событие
            await bot.telegram.sendMessage(event.chatId, text);
        } catch (err) {
            console.error("Ошибка при отправке уведомления в чат:", err);
        }

        // уведомления в личку всем приглашённым, кто известен
        for (const invite of event.invites) {
            const user = getUserByUsername(invite.username);
            if (!user) continue;

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
