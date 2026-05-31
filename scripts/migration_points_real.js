
import Database from 'better-sqlite3';

const db = new Database('sportsreg.db');

try {
    console.log('Starting migration: Upgrade points table to support REAL amount...');

    db.transaction(() => {
        // 1. Rename old table
        db.prepare('ALTER TABLE points RENAME TO points_old').run();

        // 2. Create new table with REAL amount
        db.prepare(`
      CREATE TABLE points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        match_id INTEGER,
        amount REAL NOT NULL,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `).run();

        // 3. Copy data
        db.prepare(`
      INSERT INTO points (id, user_id, match_id, amount, reason, created_at)
      SELECT id, user_id, match_id, CAST(amount AS REAL), reason, created_at
      FROM points_old
    `).run();

        // 4. Drop old table
        db.prepare('DROP TABLE points_old').run();
    })();

    console.log('Migration successful: points table upgraded.');
} catch (error) {
    console.error('Migration failed:', error);
}
