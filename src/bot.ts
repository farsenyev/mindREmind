import { Telegraf } from "telegraf";
import * as dotenv from "dotenv";

import { registerStartCommand } from "./commands/start";

dotenv.config();

const token = process.env.BOT_TOKEN;
if (!token) {
    throw new Error("BOT_TOKEN is missing");
}

const bot = new Telegraf(token);

registerStartCommand(bot)

bot.launch().then(() => {
    console.log("Reminder bot is running 🚀");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));