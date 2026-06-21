import { Markup } from 'telegraf';

// Главное меню
export const mainMenuKb = () => Markup.inlineKeyboard([
    [Markup.button.callback('➕ Создать лобби', 'menu_create'), Markup.button.callback('🔑 Войти по коду', 'menu_join')],
    [Markup.button.callback('📂 Мои лобби', 'menu_my_rooms'), Markup.button.callback('📜 Правила', 'menu_rules')]
]);

// Интерфейс внутри лобби
export const lobbyKb = (isHost) => {
    const buttons = [
        [Markup.button.callback('🔄 Обновить список', 'lobby_refresh')]
    ];
    if (isHost) {
        buttons.push([Markup.button.callback('⚙️ Настройки', 'lobby_settings')]);
        buttons.push([Markup.button.callback('🚀 СТАРТ ИГРЫ', 'lobby_start')]);
    }
    buttons.push([Markup.button.callback('🚪 Покинуть лобби', 'lobby_leave')]);
    return Markup.inlineKeyboard(buttons);
};

// Твои новые гибкие настройки со стрелочками (+ и -)
export const settingsKb = (currentPlayers, currentLimit, currentTime) => Markup.inlineKeyboard([
    [
        Markup.button.callback('👥 Игроков:', 'noop'),
        Markup.button.callback('➖', 'sub_limit'),
        Markup.button.callback(`${currentLimit}`, 'noop'),
        Markup.button.callback('➕', 'add_limit')
    ],
    [
        Markup.button.callback('⏱ Время:', 'noop'),
        Markup.button.callback('➖', 'sub_time'),
        Markup.button.callback(`${currentTime} мин`, 'noop'),
        Markup.button.callback('➕', 'add_time')
    ],
    [Markup.button.callback('🔙 Назад в лобби', 'lobby_refresh')]
]);

// Кнопки голосования
export const voteKb = (players) => {
    const buttons = players.map(p => [Markup.button.callback(`🚫 Проголосовать за ${p.name}`, `vote_${p.id}`)]);
    return Markup.inlineKeyboard(buttons);
};
