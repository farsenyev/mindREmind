import {Context, Telegraf} from "telegraf";
import dayjs from "dayjs";
import {deleteReminder, getReminderById, scheduleReminder, updateReminder} from "../services/reminderService";
import { parseReminder } from "../utils/parseReminder";

export async function handleRemindWizardInput(bot: Telegraf, ctx: Context, raw: string) {
    if (!ctx.chat || !ctx.from) {
        await ctx.reply("Не могу определить чат или пользователя 🤔");
        return;
    }

    const parsed = parseReminder(raw);
    if (!parsed) {
        await ctx.reply(
            "Не смогла понять время 😔\n" +
            "Примеры:\n" +
            "`15m купить хлеб`\n" +
            "`2h созвон с коллегой`\n" +
            "`2025-12-10 19:30 важный звонок`",
            { parse_mode: "Markdown" },
        );
        return;
    }

    const { fireAt, text } = parsed;
    const chatId = ctx.chat?.id

    const reminder = scheduleReminder(bot, chatId, text, fireAt)
    if (!reminder) {
        ctx.reply("Время напоминания уже прошло или слишком близко к текущему.")
        return;
    }

    const whenStr = dayjs(fireAt).format("YYYY-MM-DD HH:mm")
    ctx.reply(`Окей, напомню 📅 ${whenStr}\nТекст: "${text}"`)
}

export const registerRemindCommand = (bot: Telegraf) => {
    bot.command("remind", (ctx) => {
        const messageText = ctx.message?.text || ""
        const args = messageText.replace(/^\/remind(@\w+)?\s*/i, "")

        if (!args) {
            ctx.reply(
                "Формат:\n" +
                "/remind 10m текст\n" +
                "/remind 2h текст\n" +
                "/remind 1d текст\n" +
                "/remind 2025-12-02 18:30 текст"
            );
            return;
        }

        const parsed = parseReminder(args);
        if (!parsed) {
            ctx.reply(
                "Не смог понять время 😔\nПопробуй так:\n" +
                "• 10m купить молоко\n" +
                "• 2h созвон\n" +
                "• 1d оплатить\n" +
                "• 2025-12-02 18:30 позвонить маме"
            );
            return;
        }

        const { fireAt, text } = parsed;
        const chatId = ctx.chat?.id
        if (!chatId) {
            ctx.reply("Не смог определить чат")
            return;
        }

        const reminder = scheduleReminder(bot, chatId, text, fireAt)
        if (!reminder) {
            ctx.reply("Время напоминания уже прошло или слишком близко к текущему.")
            return;
        }

        const whenStr = dayjs(fireAt).format("YYYY-MM-DD HH:mm")
        ctx.reply(`Окей, напомню 📅 ${whenStr}\nТекст: "${text}"`)
    })

    bot.command("rdelete", async (ctx) => {
        const messageText = ctx.message?.text || "";
        const args = messageText.replace(/^\/rdelete(@\w+)?\s*/i, "").trim();

        if (!args) {
            await ctx.reply('Формат: `/rdelete 3` — удалить напоминание #R3', {
                parse_mode: "Markdown",
            });
            return;
        }

        const id = Number(args);
        if (!Number.isFinite(id)) {
            await ctx.reply("Не смогла понять номер напоминания 🤔");
            return;
        }

        const reminder = getReminderById(id);
        if (!reminder) {
            await ctx.reply(`Не нашла напоминание #R${id}`);
            return;
        }

        deleteReminder(id);

        await ctx.reply(`❌ Напоминание #R${id} удалено.\nТекст был: "${reminder.text}"`);
    })

    bot.command("redit", async (ctx) => {
        const messageText = ctx.message?.text || "";
        const args = messageText.replace(/^\/redit(@\w+)?\s*/i, "").trim();

        if (!args) {
            await ctx.reply(
                "Формат:\n" +
                "`/redit 3 15m новый текст`\n" +
                "`/redit 3 2025-12-10 19:30 новый текст`",
                { parse_mode: "Markdown" },
            );
            return;
        }

        const [idPart, ...rest] = args.split(/\s+/);
        const id = Number(idPart);
        const restText = rest.join(" ");

        if (!Number.isFinite(id) || !restText.trim()) {
            await ctx.reply(
                "Формат:\n" +
                "`/redit 3 15m новый текст`\n" +
                "`/redit 3 2025-12-10 19:30 новый текст`",
                { parse_mode: "Markdown" },
            );
            return;
        }

        const reminder = getReminderById(id);
        if (!reminder) {
            await ctx.reply(`Не нашла напоминание #R${id}`);
            return;
        }

        const parsed = parseReminder(restText);
        if (!parsed) {
            await ctx.reply(
                "Не смогла понять новое время 😔\nПримеры:\n" +
                "`/redit 3 15m новый текст`\n" +
                "`/redit 3 2025-12-10 19:30 новый текст`",
                { parse_mode: "Markdown" },
            );
            return;
        }

        const { fireAt, text } = parsed;

        const updated = updateReminder(bot, id, fireAt, text);
        if (!updated) {
            await ctx.reply("Не удалось обновить напоминание 😔");
            return;
        }

        const whenStr = dayjs(fireAt).format("YYYY-MM-DD HH:mm");
        await ctx.reply(
            `✏️ Напоминание #R${id} обновлено.\n` +
            `Новое время: ${whenStr}\n` +
            `Текст: "${text}"`,
        );
    })


}