
import { db } from '../server/db.js';

console.log('Starting migration: Fix admin_reminders schema...');

try {
    // 1. Deduplicate: Keep the row with the HIGHEST count for each (user_id, reminder_type)
    // We can do this by deleting rows that are NOT the one with the max count.
    // Or easier: Select max counts into a temp table, truncate, and restore.

    // Strategy:
    // a. Create a temporary table with the correct schema
    db.exec(`
        CREATE TABLE IF NOT EXISTS admin_reminders_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            reminder_type TEXT CHECK(reminder_type IN ('join', 'cancel')) NOT NULL,
            count INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            UNIQUE(user_id, reminder_type)
        )
    `);

    // b. Copy data, merging duplicates by summing counts (or taking max)
    // The user problem is that they subscribe multiple times and have multiple rows. 
    // We should probably SUM the counts to be safe, so they get all the notifications they expected.
    // Group by user_id, reminder_type.

    // Let's check what data we have first to be sure.
    const rows = db.prepare('SELECT * FROM admin_reminders').all();
    console.log(`Found ${rows.length} existing rows.`);

    const insertStmt = db.prepare(`
        INSERT INTO admin_reminders_new (user_id, reminder_type, count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, reminder_type) DO UPDATE SET
        count = count + excluded.count,
        updated_at = CURRENT_TIMESTAMP
    `);

    // We can't use simple INSERT SELECT because we need to merge.
    // Actually, simple INSERT INTO ... SELECT ... GROUP BY ... might work if we sum.

    // Let's try doing it in SQL directly first.
    // INSERT INTO new SELECT user_id, reminder_type, SUM(count), MIN(created_at), MAX(updated_at) FROM old GROUP BY user_id, reminder_type

    const info = db.prepare(`
        INSERT INTO admin_reminders_new (user_id, reminder_type, count, created_at, updated_at)
        SELECT user_id, reminder_type, SUM(count), MIN(created_at), MAX(updated_at)
        FROM admin_reminders
        GROUP BY user_id, reminder_type
    `).run();

    console.log(`Migrated ${info.changes} unique subscription groups to new table.`);

    // c. Swap tables
    // Rename old to backup, new to old.
    db.exec('ALTER TABLE admin_reminders RENAME TO admin_reminders_backup_v1');
    db.exec('ALTER TABLE admin_reminders_new RENAME TO admin_reminders');

    console.log('Table swap complete. Backup stored in admin_reminders_backup_v1');

    // Verify index
    const indices = db.prepare("PRAGMA index_list('admin_reminders')").all();
    console.log('New table indices:', indices);

} catch (err) {
    console.error('Migration failed:', err);
}
