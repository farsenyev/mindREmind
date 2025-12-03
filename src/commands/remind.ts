import { Telegraf } from "telegraf";
import dayjs from "dayjs";
import { scheduleReminder } from "../services/reminderService";
import { parseReminder } from "../utils/parseReminder";

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
}