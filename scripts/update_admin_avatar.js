
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../sportsreg.db');

const db = new Database(dbPath);

try {
    const stmt = db.prepare("UPDATE users SET avatar = '/face/defaultface-admin.jpg' WHERE username = 'admin'");
    const info = stmt.run();

    if (info.changes > 0) {
        console.log('Successfully updated admin avatar.');
    } else {
        console.log('Admin user not found or avatar already set.');
    }
} catch (error) {
    console.error('Error updating admin avatar:', error);
} finally {
    db.close();
}
