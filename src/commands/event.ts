import { Context, Telegraf } from "telegraf";
import { parseEventInput } from "../utils/parserEventInput";
import {
    createEvent,
    formatEventForMessage, getEventById,
    deleteEvent
} from "../services/eventService";
import { getUserByUsername } from "../services/userService";
import {parseReminder} from "../utils/parseReminder";
import {scheduleEventNotification} from "../services/eventScheduler";

export async function handleEventCreateFromArgs(bot: Telegraf, ctx: Context, args: string) {
    if (!args.trim()) {
        await ctx.reply(
            "Формат:\n" +
            "/event 10m @user созвон\n" +
            "/event 2h @user1 @user2 встреча\n" +
            "/event 2025-12-10 19:30 @user встреча"
        );
        return;
    }

    const parsed = parseEventInput(args);
    if (!parsed) {
        await ctx.reply(
            "Не смогла понять время 😔\nПримеры:\n" +
            "/event 10m @user созвон\n" +
            "/event 1d @user подготовить отчёт\n" +
            "/event 2025-12-10 19:30 @user встреча"
        );
        return;
    }

    const chatId = ctx.chat?.id;
    const creatorId = ctx.from?.id;

    if (!chatId || !creatorId) {
        await ctx.reply("Не могу определить чат или пользователя 🤔");
        return;
    }

    const event = createEvent(
        chatId,
        creatorId,
        parsed.fireAt,
        parsed.title,
        parsed.usernames
    );

    if (ctx.from) {
        const creatorUsername = ctx.from.username || `id${ctx.from.id}`;

        const already = event.invites.some(
            (i) => i.username.toLowerCase() === creatorUsername.toLowerCase()
        );

        if (!already) {
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
                    {text: "✅ Приду", callback_data: `event_rsvp:${event.id}:yes`},
                    {text: "❌ Не смогу", callback_data: `event_rsvp:${event.id}:no`},
                ],
            ],
        },
    };

    let creatorMessage;
    const isPrivate = ctx.chat?.type === "private";

    if (isPrivate) {
        creatorMessage = await ctx.reply(text, rsvpKeyboard);
    } else {
        creatorMessage = await ctx.reply(text);

        if (ctx.from) {
            try {
                await ctx.telegram.sendMessage(
                    ctx.from.id,
                    `👋 Привет, ${ctx.from.first_name || "друг"}!\nТы создал событие:\n\n${text}`,
                    rsvpKeyboard
                );
            } catch (err) {
                console.error("Не удалось отправить приглашение создателю", err);
            }
        }
    }

    event.creatorMessageId = creatorMessage?.message_id;

    for (const invite of event.invites) {
        const username = invite.username;

        const u = getUserByUsername(username);
        if (!u) continue;

        if (ctx.from && u.id === ctx.from.id) {
            invite.userId = u.id;
            continue;
        }

        try {
            await ctx.telegram.sendMessage(
                u.id,
                `👋 Привет, ${u.firstName || username}!\nТебя пригласили на событие:\n\n${text}`,
                rsvpKeyboard
            );
            invite.userId = u.id;
        } catch (err) {
            console.error(`Не удалось отправить сообщение @${username}`, err);
        }
    }

    scheduleEventNotification(bot, event.id);
}

export async function handleEventWizardInput(
    bot: Telegraf,
    ctx: Context,
    raw: string
) {
    await handleEventCreateFromArgs(bot, ctx, raw);
}

export function registerEventCommand(bot: Telegraf) {
    bot.command("event", async (ctx) => {
        const messageText = ctx.message?.text || "";
        const args = messageText.replace(/^\/event(@\w+)?\s*/i, "");

        await handleEventCreateFromArgs(bot, ctx, args);
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
}
