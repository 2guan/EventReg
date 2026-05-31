
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../sportsreg.db');

const db = new Database(dbPath);

try {
    console.log('Updating user avatars...');

    // Update users with empty or null avatar
    // Also excluding 'admin' if handled separately, but IF admin has empty avatar this would fix it too. 
    // (Admin is already set to defaultface-admin.jpg so it won't be empty)
    // We only target role='user' or 'pending' if we want to be strict, but generic is fine.

    const stmt = db.prepare(`
    UPDATE users 
    SET avatar = '/face/defaultface-user.jpg' 
    WHERE (avatar IS NULL OR avatar = '') AND role != 'admin'
  `);

    const info = stmt.run();

    console.log(`Updated ${info.changes} user(s) to default avatar.`);

} catch (error) {
    console.error('Error updating avatars:', error);
} finally {
    db.close();
}
