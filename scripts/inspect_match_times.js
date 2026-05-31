
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../sportsreg.db');

const db = new Database(dbPath);

try {
    const matches = db.prepare('SELECT id, title, time FROM matches LIMIT 10').all();
    console.log(JSON.stringify(matches, null, 2));
} catch (error) {
    console.error(error);
}
