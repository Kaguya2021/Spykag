import { mainMenuKb, lobbyKb } from '../keyboards/gameKeyboards.js';
import { rooms, userToRoom, generateRoomCode, cleanEmptyRooms } from '../utils/storage.js';

export async function sendMainMenu(ctx) {
    cleanEmptyRooms();
    const text = `🕵️‍♂️ **Добро пожаловать в игру «Шпион»!**\n\nРазгадайте, кто скрывает свою личность, или обведите всех вокруг пальца, будучи шпионом!`;
    if (ctx.callbackQuery) {
        return ctx.editMessageText(text, { parse_mode: 'Markdown', ...mainMenuKb() });
    }
    return ctx.reply(text, { parse_mode: 'Markdown', ...mainMenuKb() });
}

export function registerMenuHandlers(bot) {
    bot.command('start', sendMainMenu);

    bot.action('menu_rules', async (ctx) => {
        const rules = `📜 **Правила игры «Шпион»**\n\n` +
            `1. Все игроки, кроме одного (Шпиона), знают секретную **локацию**.\n` +
            `2. Задача игроков — вычислить Шпиона, задавая друг другу вопросы.\n` +
            `3. Задача Шпиона — понять, где они находятся, или дождаться конца таймера, не выдав себя.\n` +
            `4. По истечении времени запускается голосование.`;
        await ctx.editMessageText(rules, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 В меню', 'main_menu')]]) });
    });

    bot.action('main_menu', sendMainMenu);

    bot.action('menu_create', async (ctx) => {
        const userId = ctx.from.id;
        if (userToRoom.has(userId)) {
            return ctx.answerCbQuery('❌ Вы уже находитесь в лобби!', { show_alert: true });
        }

        const code = generateRoomCode();
        const newRoom = {
            code,
            hostId: userId,
            players: [{ id: userId, name: ctx.from.first_name || 'Игрок' }],
            maxPlayers: 8,
            gameTime: 5, // в минутах
            status: 'idle', // idle, playing, voting
            spyId: null,
            location: '',
            votes: {}, // userId -> votedForId
            timerId: null
        };

        rooms.set(code, newRoom);
        userToRoom.set(userId, code);

        await ctx.answerCbQuery('Лобби создано! 🎉');
        return renderLobby(ctx, newRoom);
    });

    bot.action('menu_join', async (ctx) => {
        await ctx.answerCbQuery();
        return ctx.reply('🔑 Отправьте код комнаты сообщением (например: `ABCDEF`):', { parse_mode: 'Markdown' });
    });

    bot.action('menu_my_rooms', async (ctx) => {
        const code = userToRoom.get(ctx.from.id);
        if (!code || !rooms.has(code)) {
            return ctx.answerCbQuery('❌ Вы не состоите в лобби', { show_alert: true });
        }
        await ctx.answerCbQuery();
        return renderLobby(ctx, rooms.get(code));
    });
}

export async function renderLobby(ctx, room) {
    let playerList = room.players.map((p, i) => `${i + 1}. ${p.id === room.hostId ? '👑 ' : '👤 '}${p.name}`).join('\n');
    const text = `🚪 **Комната:** \`${room.code}\`\n\n` +
        `👥 **Игроки (${room.players.length}/${room.maxPlayers}):**\n${playerList}\n\n` +
        `⚙️ **Настройки:**\n` +
        `⏱ Время: ${room.gameTime} мин.\n` +
        `🌐 Локации: По умолчанию (Случайные)\n\n` +
        `${room.status === 'idle' ? '⏳ Ожидание игроков и старта...' : '🎮 Игра уже идет!'}`;

    try {
        if (ctx.callbackQuery) {
            await ctx.editMessageText(text, { parse_mode: 'Markdown', ...lobbyKb(ctx.from.id === room.hostId) });
        } else {
            await ctx.reply(text, { parse_mode: 'Markdown', ...lobbyKb(ctx.from.id === room.hostId) });
        }
    } catch (e) {
        // Игнорируем ошибку одинакового контента при обновлении списка
    }
}
