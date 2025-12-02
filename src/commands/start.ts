import { Telegraf } from "telegraf";

export function registerStartCommand(bot: Telegraf) {
    bot.start((ctx) => {
        ctx.reply(
            `Привет, ${ctx.from.first_name || "друг"}! 👋
Я бот-напоминалка.
Для просмотра всех команд пиши /help
`
        );
    });
}