import { Telegraf } from "telegraf";

export function registerHelpCommand(bot: Telegraf) {
    bot.command("help", (ctx) => {
        ctx.reply(
            `Привет, ${ctx.from.first_name || "друг"}! 👋
Список команд:
/start
/help
/remind [time в формате ГГГГ-ММ-ДД ЧЧ:ММ или 1d/h/m] [text]
`
        );
    });
}