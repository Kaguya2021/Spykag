import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { registerMenuHandlers } from './handlers/menuHandler.js';
import { registerLobbyHandlers } from './handlers/lobbyHandler.js';
import { registerGameHandlers } from './handlers/gameHandler.js';

// Загружаем переменные из файла .env
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
    console.error("❌ Ошибка: Переменная BOT_TOKEN не найдена в файле .env!");
    process.exit(1);
}

// Инициализируем бота
const bot = new Telegraf(BOT_TOKEN);

// Глобальный обработчик ошибок
bot.use(async (ctx, next) => {
    try {
        await next();
    } catch (err) {
        console.error(`🔴 Глобальная ошибка обработки (${ctx.update?.update_id}):`, err);
        try {
            await ctx.reply('⚠️ Произошла внутренняя ошибка. Попробуйте еще раз или вернитесь в /start.');
        } catch (e) {}
    }
});

// Регистрация слоев логики игры
registerMenuHandlers(bot);
registerLobbyHandlers(bot);
registerGameHandlers(bot);

// СРАЗУ пишем в консоль, что начинаем запуск
console.log('⏳ Запуск бота... Пожалуйста, подождите.');

// Запуск бота
bot.launch().then(() => {
    console.log('🚀 Бот игры «Шпион» успешно подключен к серверам Telegram и ЖДЕТ игроков!');
}).catch((err) => {
    console.error('❌ Не удалось запустить бота:', err);
});

// Корректное завершение процесса при остановке в Termux
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

