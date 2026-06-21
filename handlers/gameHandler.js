import { rooms, userToRoom, allLocations } from '../utils/storage.js';
import { voteKb } from '../keyboards/gameKeyboards.js';
import { sendMainMenu } from './menuHandler.js';
import { Markup } from 'telegraf';

export function registerGameHandlers(bot) {
    bot.action('lobby_start', async (ctx) => {
        const code = userToRoom.get(ctx.from.id);
        const room = rooms.get(code);

        if (!room) return ctx.answerCbQuery();
        if (room.hostId !== ctx.from.id) return ctx.answerCbQuery('Только хост запускает игру!');
        if (room.players.length < 3) return ctx.answerCbQuery('❌ Нужно минимум 3 игрока!', { show_alert: true });

        room.status = 'playing';
        room.votes = {};
        room.endTime = Date.now() + (room.gameTime * 60 * 1000);

        // --- СИСТЕМА ПРЕДОТВРАЩЕНИЯ ПОВТОРОВ ЛОКАЦИЙ ---
        if (!room.usedLocations) {
            room.usedLocations = [];
        }

        // Фильтруем: убираем те места, в которые уже играли в этой комнате
        let availableLocations = allLocations.filter(loc => !room.usedLocations.includes(loc));

        // Если сыграли во все локации, сбрасываем историю по кругу
        if (availableLocations.length === 0) {
            room.usedLocations = [];
            availableLocations = [...allLocations];
        }

        // Выбираем случайную локацию из оставшихся и запоминаем её
        const randomLoc = availableLocations[Math.floor(Math.random() * availableLocations.length)];
        room.location = randomLoc;
        room.usedLocations.push(randomLoc);
        // ------------------------------------------------

        // Выбор случайного шпиона
        const spyIndex = Math.floor(Math.random() * room.players.length);
        room.spyId = room.players[spyIndex].id;

        await ctx.answerCbQuery('Игра начинается! Рассылаю роли...');

        // Рассылка ролей в ЛС каждому игроку
        for (const player of room.players) {
            try {
                if (player.id === room.spyId) {
                    await bot.telegram.sendMessage(player.id, '🕵️‍♂️ **ТЫ ШПИОН!**\n\nТвоя задача — не выдать себя и узнать локацию у других.');
                } else {
                    await bot.telegram.sendMessage(player.id, `📍 **Локация:** \`${room.location}\`\n\nВычисляй шпиона, задавая аккуратные вопросы!`, { parse_mode: 'Markdown' });
                }
            } catch (err) {
                await ctx.reply(`⚠️ Не удалось отправить роль игроку ${player.name}. Убедитесь, что бот запущен у него в ЛС.`);
            }
        }

        // Кнопки управления игрой для хоста в общем чате лобби
        const hostControlKb = Markup.inlineKeyboard([
            [Markup.button.callback('⏱ Проверить время', 'game_check_time')],
            [Markup.button.callback('🚫 Начать голосование сейчас', 'game_force_vote')]
        ]);

        await ctx.reply(
            `🚀 **ИГРА НАЧАЛАСЬ!** Код лобби: \`${room.code}\`\n\n` +
            `Роли отправлены в личные сообщения. У вас есть ${room.gameTime} мин. на обсуждение!`, 
            { parse_mode: 'Markdown', ...hostControlKb }
        );

        // Сброс старого таймера (если остался от прошлых игр)
        if (room.timerId) clearInterval(room.timerId);

        // Проверка времени каждые 15 секунд (защита от "засыпания" Android)
        room.timerId = setInterval(() => {
            if (Date.now() >= room.endTime && room.status === 'playing') {
                clearInterval(room.timerId);
                endGameAndStartVoting(bot, room);
            }
        }, 15000);
    });

    // Обработка кнопки ручной проверки оставшегося времени
    bot.action('game_check_time', async (ctx) => {
        const code = userToRoom.get(ctx.from.id);
        const room = rooms.get(code);
        if (!room || room.status !== 'playing') return ctx.answerCbQuery('Игра не идет.');

        const timeLeft = Math.max(0, Math.ceil((room.endTime - Date.now()) / 1000));
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;

        await ctx.answerCbQuery(`⏳ Осталось времени: ${minutes}м ${seconds}с`, { show_alert: true });
    });

    // Досрочный переход к голосованию по кнопке хоста
    bot.action('game_force_vote', async (ctx) => {
        const code = userToRoom.get(ctx.from.id);
        const room = rooms.get(code);
        if (!room) return ctx.answerCbQuery();
        if (room.hostId !== ctx.from.id) return ctx.answerCbQuery('Только хост может досрочно начать голосование!');
        
        if (room.timerId) clearInterval(room.timerId);
        await ctx.answerCbQuery('Раунд завершен досрочно!');
        await endGameAndStartVoting(bot, room);
    });

    // Сбор голосов от игроков
    bot.action(/^vote_(\d+)$/, async (ctx) => {
        const voterId = ctx.from.id;
        const code = userToRoom.get(voterId);
        const room = rooms.get(code);

        if (!room || room.status !== 'voting') return ctx.answerCbQuery('Голосование окончено или еще не началось.');
        if (room.votes[voterId]) return ctx.answerCbQuery('Вы уже отдали свой голос!', { show_alert: true });

        const votedForId = parseInt(ctx.match[1]);
        room.votes[voterId] = votedForId;

        await ctx.answerCbQuery('Ваш голос принят!');
        
        // Когда все игроки проголосовали — выводим итог
        if (Object.keys(room.votes).length === room.players.length) {
            await processVoteResults(bot, room);
        }
    });
}

// Перевод лобби в режим голосования и отправка кнопок
async function endGameAndStartVoting(bot, room) {
    room.status = 'voting';
    
    for (const player of room.players) {
        try {
            await bot.telegram.sendMessage(
                player.id, 
                `⏱ **Время вышло!** Начинается фаза голосования.\n\n` +
                `Кто по вашему мнению шпион? Выберите игрока:`, 
                {
                    parse_mode: 'Markdown',
                    ...voteKb(room.players.filter(p => p.id !== player.id))
                }
            );
        } catch (e) {
            console.error(`Не удалось отправить кнопки голосования для ${player.name}`);
        }
    }
}

// Подсчет результатов мажоритарного голосования
async function processVoteResults(bot, room) {
    const voteCounts = {};
    for (const targetId of Object.values(room.votes)) {
        voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    }

    let maxVotes = 0;
    let suspectedId = null;
    let tie = false;

    for (const [targetId, count] of Object.entries(voteCounts)) {
        if (count > maxVotes) {
            maxVotes = count;
            suspectedId = parseInt(targetId);
            tie = false;
        } else if (count === maxVotes) {
            tie = true;
        }
    }

    const spyPlayer = room.players.find(p => p.id === room.spyId);
    let resultText = `📊 **Результаты раунда:**\n\n`;

    if (tie || !suspectedId) {
        resultText += `🤝 Мнения разделились! Никого не выбрали.\n\n🏆 **Победа Шпиона!** (Это был ${spyPlayer.name})`;
    } else {
        const suspectedPlayer = room.players.find(p => p.id === suspectedId);
        resultText += `👥 Большинство проголосовало против: *${suspectedPlayer.name}*\n\n`;

        if (suspectedId === room.spyId) {
            resultText += `🎉 **Победа Мирных!** Вы успешно раскрыли шпиона (*${spyPlayer.name}*).`;
        } else {
            resultText += `💀 Вы казнили невиновного гражданина! \n\n🏆 **Победа Шпиона!** Скрывающимся шпионом был: *${spyPlayer.name}*.`;
        }
    }

    resultText += `\n\n📍 Секретная локация раунда: *${room.location}*`;

    // Оповещаем всех участников об итогах и удаляем отметки комнат у пользователей
    for (const player of room.players) {
        try {
            await bot.telegram.sendMessage(player.id, resultText, { parse_mode: 'Markdown' });
            userToRoom.delete(player.id);
        } catch (e) {}
    }

    // Удаляем отыгранную комнату, сохраняя данные сессии для новых игр
    rooms.delete(room.code);
}
