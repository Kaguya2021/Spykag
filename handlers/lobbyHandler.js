import { rooms, userToRoom } from '../utils/storage.js';
import { renderLobby, sendMainMenu } from './menuHandler.js';
import { settingsKb } from '../keyboards/gameKeyboards.js';

export function registerLobbyHandlers(bot) {
    // Текстовый ввод кода комнаты
    bot.on('text', async (ctx, next) => {
        const text = ctx.message.text.trim().toUpperCase();
        if (text.length === 6 && rooms.has(text)) {
            const room = rooms.get(text);
            const userId = ctx.from.id;

            if (userToRoom.has(userId)) {
                return ctx.reply('❌ Вы уже находитесь в каком-то лобби. Покиньте его сначала.');
            }
            if (room.players.length >= room.maxPlayers) {
                return ctx.reply('❌ Комната заполнена!');
            }
            if (room.status !== 'idle') {
                return ctx.reply('❌ Игра в этой комнате уже началась.');
            }

            room.players.push({ id: userId, name: ctx.from.first_name || 'Игрок' });
            userToRoom.set(userId, text);

            await ctx.reply(`✅ Вы вошли в комнату \`${text}\``, { parse_mode: 'Markdown' });
            return renderLobby(ctx, room);
        }
        return next();
    });

    // Обновление лобби
    bot.action('lobby_refresh', async (ctx) => {
        const code = userToRoom.get(ctx.from.id);
        if (!code) return sendMainMenu(ctx);
        await ctx.answerCbQuery('Обновлено');
        return renderLobby(ctx, rooms.get(code));
    });

    // Открытие настроек хостом
    bot.action('lobby_settings', async (ctx) => {
        const code = userToRoom.get(ctx.from.id);
        const room = rooms.get(code);
        if (!room || room.hostId !== ctx.from.id) return ctx.answerCbQuery('Только хост может управлять настройками!');
        
        await ctx.answerCbQuery();
        await ctx.editMessageText(
            `⚙️ **Настройки комнаты** \`${room.code}\`\n\nУстановите лимит игроков (3-15) и время раунда (1-60 мин):`, 
            { 
                parse_mode: 'Markdown', 
                ...settingsKb(room.players.length, room.maxPlayers, room.gameTime) 
            }
        );
    });

    // Обработка пошагового изменения (+ и -)
    bot.action(/^(add|sub)_(limit|time)$/, async (ctx) => {
        const code = userToRoom.get(ctx.from.id);
        const room = rooms.get(code);
        if (!room || room.hostId !== ctx.from.id) return ctx.answerCbQuery();

        const action = ctx.match[1]; // add или sub
        const target = ctx.match[2]; // limit или time

        if (target === 'limit') {
            if (action === 'add' && room.maxPlayers < 15) room.maxPlayers++;
            if (action === 'sub' && room.maxPlayers > 3 && room.maxPlayers > room.players.length) room.maxPlayers--;
        }

        if (target === 'time') {
            if (action === 'add' && room.gameTime < 60) room.gameTime++;
            if (action === 'sub' && room.gameTime > 1) room.gameTime--;
        }

        await ctx.answerCbQuery();
        
        await ctx.editMessageText(
            `⚙️ **Настройки комнаты** \`${room.code}\`\n\nУстановите лимит игроков (3-15) и время раунда (1-60 мин):`, 
            { 
                parse_mode: 'Markdown', 
                ...settingsKb(room.players.length, room.maxPlayers, room.gameTime) 
            }
        );
    });

    // Заглушка для текста на кнопках
    bot.action('noop', async (ctx) => ctx.answerCbQuery());

    // Выход из лобби
    bot.action('lobby_leave', async (ctx) => {
        const userId = ctx.from.id;
        const code = userToRoom.get(userId);
        if (!code) return sendMainMenu(ctx);

        const room = rooms.get(code);
        room.players = room.players.filter(p => p.id !== userId);
        userToRoom.delete(userId);

        if (room.players.length > 0 && room.hostId === userId) {
            room.hostId = room.players[0].id;
        }

        await ctx.answerCbQuery('Вы покинули лобби');
        return sendMainMenu(ctx);
    });
}

