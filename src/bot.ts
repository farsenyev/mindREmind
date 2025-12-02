// @ts-ignore
import { Telegraf } from "telegraf";
// @ts-ignore
import * as dotenv from "dotenv";

dotenv.config();

const token = process.env.BOT_TOKEN;
if (!token) {
    throw new Error("BOT_TOKEN is missing");
}

const bot = new Telegraf(token);

bot.start((ctx) => {
    ctx.reply(`Привет, ${ctx.from.first_name || "друг"}! Я бот на TypeScript + pnpm 🚀`)
});

bot.help((ctx) => {
    ctx.reply("Доступные команды:\n/start — приветствие\n/help — помощь")
})

bot.on("text", (ctx) => {
    ctx.reply(`Ты написал: ${ctx.message.text}`);
})

bot.launch().then(() => {
    console.log("Bot is running 🚀");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));