import { Telegraf } from "telegraf";
import {registerUser} from "../services/userService";

export function registerStartCommand(bot: Telegraf) {
    bot.start((ctx) => {
        if (ctx.from) {
            registerUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
        }

        ctx.reply(
            `Привет, ${ctx.from.first_name || "друг"}! 👋
Я бот-напоминалка.
Для просмотра всех команд пиши /help
Если ты меня запустишь в личке или в группе, я смогу присылать тебе личные приглашения и напоминания.
`
        );
    });
}