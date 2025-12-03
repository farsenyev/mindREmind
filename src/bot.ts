import { Telegraf } from "telegraf";
import * as dotenv from "dotenv";

import { registerStartCommand } from "./commands/start";
import { registerRemindCommand } from "./commands/remind";
import { registerHelpCommand } from "./commands/help";
import { registerEventCommand } from "./commands/event";
import {registerListCommand} from "./commands/list";

dotenv.config();

const token = process.env.BOT_TOKEN;
if (!token) {
    throw new Error("BOT_TOKEN is missing");
}

const bot = new Telegraf(token);

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