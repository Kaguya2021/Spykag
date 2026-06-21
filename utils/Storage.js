import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const locationsPath = path.resolve(__dirname, '../data/locations.json');

// Загрузка локаций
export const allLocations = JSON.parse(fs.readFileSync(locationsPath, 'utf-8'));

// Глобальное состояние комнат и связи пользователей с комнатами
export const rooms = new Map(); // code -> roomData
export const userToRoom = new Map(); // userId -> code

// Генерация уникального кода комнаты
export function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Без схожих символов (O, 0, I, 1)
    let code;
    do {
        code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (rooms.has(code));
    return code;
}

// Очистка пустых лобби
export function cleanEmptyRooms() {
    for (const [code, room] of rooms.entries()) {
        if (room.players.length === 0) {
            rooms.delete(code);
        }
    }
}
