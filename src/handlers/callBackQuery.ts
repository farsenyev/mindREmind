import { Telegraf, Context } from "telegraf";
import {
    getEventById,
    updateRsvp,
    formatEventForMessage,
    deleteEvent,
} from "../services/eventService";
import {
    getReminderById,
    deleteReminder,
} from "../services/reminderService";
import dayjs from "dayjs";

export function registerCallbackQueryHandler(bot: Telegraf) {
    bot.on("callback_query", async (ctx: Context) => {
        const cq: any = ctx.callbackQuery;
        const data: string | undefined =
            cq && "data" in cq && typeof cq.data === "string" ? cq.data : undefined;

        if (!data) {
            await ctx.answerCbQuery();
            return;
        }

        const sendCreatorUpdate = async (eventId: number, newText: string) => {
            const event = getEventById(eventId);
            if (!event || !event.creatorMessageId) return;

            const creatorInvite = event.invites.find(
                (i) => i.userId === event.creatorId,
            );

            let creatorReplyMarkup:
                | { reply_markup: { inline_keyboard: any[][] } }
                | undefined;

            if (creatorInvite && creatorInvite.status === "pending") {
                creatorReplyMarkup = {
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
            }

            try {
                await bot.telegram.editMessageText(
                    event.chatId,
                    event.creatorMessageId,
                    undefined,
                    newText,
                    creatorReplyMarkup,
                );
            } catch (err: any) {
                const desc: string | undefined = err?.response?.description;
                if (!desc || !desc.includes("message is not modified")) {
                    console.error("Не удалось обновить сообщение создателя события", err);
                }
            }
        };

        if (data.startsWith("event_view:")) {
            const [, idStr] = data.split(":");
            const eventId = Number(idStr);
            const event = getEventById(eventId);

            if (!event) {
                await ctx.answerCbQuery("Событие не найдено");
                return;
            }

            const text = formatEventForMessage(event);
            const isCreator = ctx.from?.id === event.creatorId;

            const extra = isCreator
                ? {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "✏️ Edit",
                                    callback_data: `event_edit:${event.id}`,
                                },
                                {
                                    text: "🗑 Delete",
                                    callback_data: `event_delete:${event.id}`,
                                },
                            ],
                        ],
                    }
                }
                : {}
            try {
                await ctx.editMessageText(text, extra);
            } catch (err) {}

            await ctx.answerCbQuery();
            return;
        }

        if (data.startsWith("event_delete:")) {
            const [, idStr] = data.split(":");
            const eventId = Number(idStr);
            const event = getEventById(eventId);

            if (!event) {
                await ctx.answerCbQuery("Событие уже удалено");
                try {
                    await ctx.editMessageText("❌ Это событие уже удалено.");
                } catch {}
                return;
            }

            if (!ctx.from || ctx.from.id !== event.creatorId) {
                await ctx.answerCbQuery("Удалять может только создатель");
                return;
            }

            deleteEvent(eventId);

            try {
                await ctx.editMessageText(
                    `❌ Событие #${eventId} "${event.title}" удалено.`,
                );
            } catch {}

            await ctx.answerCbQuery("Событие удалено");
            return;
        }

        if (data.startsWith("event_edit:")) {
            const [, idStr] = data.split(":");
            const eventId = Number(idStr);
            const event = getEventById(eventId);

            if (!event) {
                await ctx.answerCbQuery("Событие не найдено");
                try {
                    await ctx.editMessageText("❌ Событие не найдено.");
                } catch {}
                return;
            }

            if (!ctx.from || ctx.from.id !== event.creatorId) {
                await ctx.answerCbQuery("Редактировать может только создатель");
                return;
            }

            const helpText =
                `✏️ Событие #${eventId}\n` +
                `Текущее описание: "${event.title}"\n\n` +
                "Чтобы изменить, используй:\n" +
                "`/edit " +
                eventId +
                " 15m новый текст`\n" +
                "`/edit " +
                eventId +
                " 2025-12-10 19:30 новый текст`";

            try {
                await ctx.editMessageText(helpText, { parse_mode: "Markdown" });
            } catch {}

            await ctx.answerCbQuery();
            return;
        }

        if (data.startsWith("rem_view:")) {
            const [, idStr] = data.split(":");
            const id = Number(idStr);

            if (!Number.isFinite(id)) {
                await ctx.answerCbQuery("Неверный номер напоминания");
                return;
            }

            const reminder = getReminderById(id);
            if (!reminder) {
                await ctx.answerCbQuery("Напоминание не найдено");
                try {
                    await ctx.editMessageText("❌ Напоминание не найдено.");
                } catch {}
                return;
            }

            const whenStr = dayjs(reminder.fireAt).format("YYYY-MM-DD HH:mm");
            const text =
                `⏰ Напоминание #R${reminder.id}\n` +
                `Когда: ${whenStr}\n` +
                `Текст: ${reminder.text}`;

            try {
                await ctx.editMessageText(text, {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "✏️ Edit",
                                    callback_data: `rem_edit:${reminder.id}`,
                                },
                                {
                                    text: "🗑 Delete",
                                    callback_data: `rem_del:${reminder.id}`,
                                },
                            ],
                        ],
                    }

            })
            } catch (err) {}

            await ctx.answerCbQuery();
            return;
        }

        if (data.startsWith("rem_del:")) {
            const [, idStr] = data.split(":");
            const id = Number(idStr);

            if (!Number.isFinite(id)) {
                await ctx.answerCbQuery("Неверный номер напоминания");
                return;
            }

            const reminder = getReminderById(id);
            if (!reminder) {
                await ctx.answerCbQuery("Напоминание уже удалено");
                try {
                    await ctx.editMessageText("❌ Это напоминание уже удалено.");
                } catch {}
                return;
            }

            deleteReminder(id);

            try {
                await ctx.editMessageText(
                    `❌ Напоминание #R${id} удалено.\nТекст был: "${reminder.text}"`,
                );
            } catch {}

            await ctx.answerCbQuery("Напоминание удалено");
            return;
        }

        if (data.startsWith("rem_edit:")) {
            const [, idStr] = data.split(":");
            const id = Number(idStr);

            if (!Number.isFinite(id)) {
                await ctx.answerCbQuery("Неверный номер напоминания");
                return;
            }

            const reminder = getReminderById(id);
            if (!reminder) {
                await ctx.answerCbQuery("Напоминание не найдено");
                try {
                    await ctx.editMessageText("❌ Напоминание не найдено.");
                } catch {}
                return;
            }

            const helpText =
                `✏️ Напоминание #R${id}\n` +
                `Текущий текст: "${reminder.text}"\n\n` +
                "Чтобы изменить, используй:\n" +
                "`/redit " +
                id +
                " 15m новый текст`\n" +
                "`/redit " +
                id +
                " 2025-12-10 19:30 новый текст`";

            try {
                await ctx.editMessageText(helpText, { parse_mode: "Markdown" });
            } catch {}

            await ctx.answerCbQuery();
            return;
        }

        if (data.startsWith("event_rsvp:")) {
            const [, idStr, statusStr] = data.split(":");
            const eventId = Number(idStr);
            const status = statusStr === "yes" ? "yes" : "no";

            const event = getEventById(eventId);
            if (!event) {
                await ctx.answerCbQuery("Событие не найдено");
                return;
            }

            const fromId = ctx.from?.id;
            const fromUsername = ctx.from?.username;

            if (!fromId || !fromUsername) {
                await ctx.answerCbQuery("Мне нужен твой username 🙈");
                return;
            }

            const updated = updateRsvp(eventId, fromUsername, fromId, status);
            if (!updated) {
                await ctx.answerCbQuery("Не нашла событие или тебя там нет 😅");
                return;
            }

            const newText = formatEventForMessage(updated);

            try {
                await ctx.editMessageText(newText);
            } catch {}

            await sendCreatorUpdate(eventId, newText);

            await ctx.answerCbQuery("Ответ записан 👍");
            return;
        }

        await ctx.answerCbQuery();
    });
}
