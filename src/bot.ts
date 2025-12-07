import {Markup, Telegraf} from "telegraf";
import * as dotenv from "dotenv";

import { registerStartCommand } from "./commands/start";
import {handleRemindWizardInput, registerRemindCommand} from "./commands/remind";
import { registerHelpCommand } from "./commands/help";
import {handleEventWizardInput, registerEventCommand} from "./commands/event";
import { handleList, registerListCommand } from "./commands/list";
import {registerCallbackQueryHandler} from "./handlers/callBackQuery";

type PendingAction = | {type: "remind"} | {type: "event"}

const pendingByUser = new Map<number, PendingAction>()

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
    if (!ctx.from) return;
    pendingByUser.set(ctx.from.id, { type: "remind" });

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
    if (!ctx.from) return;
    pendingByUser.set(ctx.from.id, { type: "event" });

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
registerListCommand(bot)
registerCallbackQueryHandler(bot)

bot.on("text", async (ctx, next) => {
    const text = ctx.message?.text || "";
    const userId = ctx.from?.id;

    if (text.startsWith("/")) {
        return next();
    }

    if (!userId) {
        return next();
    }

    const pending = pendingByUser.get(userId);
    if (!pending) {
        return next();
    }

    if (pending.type === "remind") {
        await handleRemindWizardInput(bot, ctx, text);
        pendingByUser.delete(userId);
        return
    }
    if (pending.type === "event") {
        await handleEventWizardInput(bot, ctx, text);
        pendingByUser.delete(userId);
        return
    }

    return next()
})

bot.launch().then(() => {
    console.log("Reminder bot is running 🚀");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));