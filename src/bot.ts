import {Markup, Telegraf} from "telegraf";
import * as dotenv from "dotenv";

import { registerStartCommand } from "./commands/start";
import { registerRemindCommand } from "./commands/remind";
import { registerHelpCommand } from "./commands/help";
import { registerEventCommand } from "./commands/event";
import {handleList, registerListCommand} from "./commands/list";

dotenv.config();

const token = process.env.BOT_TOKEN;
if (!token) {
    throw new Error("BOT_TOKEN is missing");
}

const bot = new Telegraf(token);

const mainMenu = Markup.keyboard([
    ["➕ Напоминание","📅 Событие"],["📋 Список"]
]).resize()

bot.start((ctx) => {
    ctx.reply("Привет! Я бот-напоминалка 👋 "+ "\nЧто хочешь сделать?", mainMenu)
});
bot.hears("➕ Напоминание", (ctx) => {
    return ctx.reply(
        "Создаём напоминание ⏰\n" +
        "Напиши команду в формате:\n" +
        "`/remind 15m купить хлеб`\n" +
        "`/remind 2h созвон с коллегой`\n" +
        "`/remind 2025-12-10 19:30 важный звонок`",
        { parse_mode: "Markdown" },
    );
});

bot.hears("📅 Событие", (ctx) => {
    return ctx.reply(
        "Создаём событие 📅\n" +
        "Напиши команду в формате:\n" +
        "`/event 15m @user созвон`\n" +
        "`/event 2h @user1 @user2 встреча`\n" +
        "`/event 2025-12-10 19:30 @user ужин`",
        { parse_mode: "Markdown" },
    );
});

bot.hears("📋 Список", (ctx) => {
    return handleList(ctx)
});

registerStartCommand(bot)
registerHelpCommand(bot)
registerRemindCommand(bot)
registerEventCommand(bot)
registerListCommand(bot)

bot.launch().then(() => {
    console.log("Reminder bot is running 🚀");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));