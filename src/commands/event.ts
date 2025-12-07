import { Telegraf } from "telegraf";
import { parseEventInput } from "../utils/parserEventInput";
import {
    createEvent,
    formatEventForMessage, getEventById,
    updateRsvp,
    deleteEvent
} from "../services/eventService";
import { getUserByUsername } from "../services/userService";
import {parseReminder} from "../utils/parseReminder";

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

        if (ctx.from) {
            const creatorUsername = ctx.from.username || `id${ctx.from.id}`;

            const alreadyInInvites = event.invites.some(
                (i) => i.username.toLowerCase() === creatorUsername.toLowerCase()
            );

            if (!alreadyInInvites) {
                event.invites.unshift({
                    username: creatorUsername,
                    userId: ctx.from.id,
                    status: "pending",
                });
            }
        }

        const text = formatEventForMessage(event);

        const rsvpKeyboard = {
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
        };

        const isPrivate = ctx.chat?.type === "private";

        let creatorMessage;
        if (isPrivate) {
            creatorMessage = await ctx.reply(text, rsvpKeyboard);
        } else {
            creatorMessage = await ctx.reply(text);

            if (ctx.from) {
                try {
                    await ctx.telegram.sendMessage(
                        ctx.from.id,
                        `👋 Привет, ${ctx.from.first_name || "друг"}!\n` +
                        `Ты создала событие:\n\n` +
                        text,
                        rsvpKeyboard,
                    );
                } catch (err) {
                    console.error("Не удалось отправить личное приглашение создателю", err);
                }
            }
        }

        event.creatorMessageId = creatorMessage.message_id;

        for (const invite of event.invites) {
            const username = invite.username;
            const user = getUserByUsername(username);
            if (!user) continue;

            if (ctx.from && user.id === ctx.from.id) {
                invite.userId = user.id;
                continue;
            }

            try {
                await ctx.telegram.sendMessage(
                    user.id,
                    `👋 Привет, ${user.firstName || username}!\n` +
                    `Тебя пригласили на событие:\n\n` +
                    text,
                    rsvpKeyboard,
                );

                invite.userId = user.id;
            } catch (err) {
                console.error(`Не удалось отправить личное приглашение @${username}`, err);
            }
        }

        scheduleEventNotification(bot, event.id);
    });

    bot.command("delete", async (ctx) => {
        const text = ctx.message?.text || "";
        const args = text.replace(/^\/delete(@\w+)?\s*/i, "").trim();

        if (!args) {
            ctx.reply("Формат: /delete [id]\nНапример: /delete 3");
            return;
        }
        const eventId = Number(args[0]);
        if (!Number.isFinite(eventId)) {
            ctx.reply("ID события должен быть числом. Пример: /cancel 3");
            return;
        }

        const current = getEventById(eventId);
        if (!current) {
            ctx.reply(`Событие ${eventId} не найдено`)
            return;
        }

        if (!ctx.from || ctx.from.id !== current.creatorId) {
            ctx.reply("Только создатель события может его отменить 🙈");
            return;
        }

        const deleted = deleteEvent(eventId);
        if (!deleted) {
            ctx.reply("Не удалось отменить событие, попробуй ещё раз.");
            return;
        }

        await ctx.reply(`❌ Событие #${deleted.id} "${deleted.title}" отменено.`)

        if (deleted.creatorId !== current.creatorId) {
            try{
                await ctx.telegram.editMessageText(
                    deleted.chatId,
                    deleted.creatorId,
                    undefined,
                    `❌ Событие #${deleted.id} отменено.\n\n${formatEventForMessage(deleted)}`
                )
            } catch (error) {
                console.error( "Не удалось обновить сообщение создателя после отмены события", error);
            }
        }

        for (const invite of deleted.invites) {
            if (!invite.userId) continue;

            try {
                await bot.telegram.sendMessage(
                    invite.userId,
                    `❌ Событие #${deleted.id} "${deleted.title}" было отменено создателем.`
                )
            } catch (err) {
                console.error(
                    `Не удалось отправить уведомление об отмене @${invite.username}`,
                    err
                );
            }
        }
    })

    bot.command("edit", async (ctx) => {
        const text = ctx.message?.text || "";
        const args = text.replace(/^\/edit(@\w+)?\s*/i, "").trim();

        if (!args) {
            ctx.reply(
                "Формат:\n" +
                "/edit [id] [время] [новый текст]\n" +
                "Например:\n" +
                "/edit 3 2h перенесли созвон\n" +
                "/edit 3 2025-12-10 19:30 встреча у Евы",
            );
            return;
        }

        const [idPart, ...restPart] = args.split(/\s+/);
        const eventId = Number(idPart);
        const rest = restPart.join(" ");
        console.log(`restParts: ${restPart}, args: ${args}, rest: ${rest}`);

        if (!Number.isFinite(eventId) || restPart.length === 0) {
            ctx.reply(
                "Формат:\n" +
                "/edit [id] [время] [новый текст]\n" +
                "Например:\n" +
                "/edit 3 30m скорректировали время",
            );
            return;
        }

        const event = getEventById(eventId);
        if (!event) {
            ctx.reply(`Событие #${eventId} не найдено.`);
            return;
        }

        if (!ctx.from || ctx.from.id !== event.creatorId) {
            ctx.reply("Только создатель события может его редактировать 🙈");
            return;
        }

        const parsed = parseReminder(rest)
        if (!parsed) {
            ctx.reply(
                "Не смогла понять новое время 😔\n" +
                "Примеры:\n" +
                "/edit 3 15m перенесли чуть-чуть\n" +
                "/edit 3 2025-12-10 19:30 новая дата и время",
            );
            return;
        }

        event.fireAt = parsed.fireAt;
        event.title = parsed.text;

        scheduleEventNotification(bot, event.id)

        const newText = formatEventForMessage(event)

        if (event.creatorMessageId) {
            try {
                await bot.telegram.editMessageText(
                    event.chatId,
                    event.creatorMessageId,
                    undefined,
                    newText,
                );
            } catch (err) {
                console.error(
                    "Не удалось обновить сообщение создателя после редактирования события",
                    err,
                );
            }
        }

        for (const invite of event.invites) {
            if (!invite.userId) continue;

            if (ctx.from && invite.userId === ctx.from?.id) {
                continue;
            }

            try {
                await bot.telegram.sendMessage(
                    invite.userId,
                    `✏️ Событие #${event.id} было изменено создателем.\n\n` +
                    newText,
                );
            } catch (err) {
                console.error(
                    `Не удалось отправить уведомление об изменении @${invite.username}`,
                    err,
                );
            }
        }

        await ctx.reply(
            `✏️ Событие #${event.id} обновлено.\n` +
            `Новое время и описание:\n\n${newText}`,
        );
    })

    bot.on("callback_query", async (ctx) => {
        const cq = ctx.callbackQuery;
        if (!("data" in cq) || typeof cq.data !== "string") {
            return ctx.answerCbQuery();
        }

        const data = cq.data;

        const [, idStr, statusStr] = data.split(":");
        const eventId = Number(idStr);
        const event = getEventById(eventId);
        if (!event) {
            await ctx.answerCbQuery("Событие не найдено");
            return;
        }
        const text = formatEventForMessage(event);
        const isCreator = ctx.from?.id === event.creatorId;
        const status = statusStr === "yes" ? "yes" : "no";

        if (data.startsWith("event_view:")) {
            await ctx.editMessageText(text, {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                isCreator
                                    ? {
                                        text: "✏️ Edit",
                                        callback_data: `event_edit:${event.id}`,
                                    }
                                    : null,
                                isCreator
                                    ? {
                                        text: "🗑 Delete",
                                        callback_data: `event_delete:${event.id}`,
                                    }
                                    : null,
                            ].filter(Boolean) as any[],
                        ],
                    }
            });

            await ctx.answerCbQuery()
            return
        }

        if (data.startsWith("event_delete:")) {
            if (!event) {
                await ctx.answerCbQuery("Событие уже удалено");
                return;
            }

            if (!ctx.from || ctx.from.id !== event.creatorId) {
                await ctx.answerCbQuery("Удалять может только создатель");
                return;
            }

            deleteEvent(eventId);

            await ctx.editMessageText(
                `❌ Событие #${eventId} "${event.title}" удалено.`,
            );
            await ctx.answerCbQuery("Событие удалено");
            return;
        }

        if (data.startsWith("event_edit:")) {
            if (!ctx.from || ctx.from.id !== event.creatorId) {
                await ctx.answerCbQuery("Редактировать может только создатель");
                return;
            }

            await ctx.answerCbQuery();
            await ctx.reply(
                "✏️ Чтобы отредактировать это событие, напиши команду:\n" +
                "`/edit " +
                eventId +
                " 15m новый текст`\n" +
                "или\n" +
                "`/edit " +
                eventId +
                " 2025-12-10 19:30 новый текст`",
                { parse_mode: "Markdown" },
            );
            return;
        }

        if (!data.startsWith("event_rsvp:")) {
            return ctx.answerCbQuery();
        }

        const fromId = ctx.from?.id
        const fromUsername = ctx.from?.username;

        if (!fromUsername) {
            return ctx.answerCbQuery("Мне нужен твой username, чтобы записать ответ 🙈");
        }

        const updated = updateRsvp(eventId, fromUsername, fromId, status);
        if (!updated) {
            return ctx.answerCbQuery("Не нашла событие или тебя там нет 😅");
        }

        const newText = formatEventForMessage(updated);

        await ctx.editMessageText(newText);

        if (updated.creatorMessageId) {
            const creatorInvite = updated.invites.find(
                (i) => i.userId === updated.creatorId
            );

            let creatorReplyMarkup: { reply_markup: { inline_keyboard: any[][] } } | undefined;

            if (creatorInvite && creatorInvite.status === "pending") {
                creatorReplyMarkup = {
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
                };
            }

            try {
                await bot.telegram.editMessageText(
                    updated.chatId,
                    updated.creatorMessageId,
                    undefined,
                    newText,
                    creatorReplyMarkup,
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

    if (event.notificationTimeout) {
        clearTimeout(event.notificationTimeout);
    }

    const timeout = setTimeout(async () => {
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

    event.notificationTimeout = timeout
}
