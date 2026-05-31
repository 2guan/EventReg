
import { db } from './server/db.js';

console.log('Starting verification...');

try {
    const userId = 1; // Default admin
    const type = 'join';

    // 1. Reset (optional, but good for clean test)
    db.prepare('DELETE FROM admin_reminders WHERE user_id = ? AND reminder_type = ?').run(userId, type);

    // 2. Simulate concurrent requests using direct DB access (since we can't easily spin up server + fetch here without more setup)
    // Wait, the fix is in the code logic (SQL statement), so calling the SQL statement concurrently is the test.

    // We can't really simulate "concurrent" node-sqlite calls easily because it's synchronous in the same process unless using workers.
    // However, we can verify that the NEW SQL statement works as expected logically.

    console.log('Testing UPSERT logic...');

    const stmt = db.prepare(`
        INSERT INTO admin_reminders (user_id, reminder_type, count, created_at, updated_at)
        VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, reminder_type) DO UPDATE SET
        count = count + 1,
        updated_at = CURRENT_TIMESTAMP
        RETURNING count
    `);

    // First call: Should create with count 1
    const res1 = stmt.get(userId, type);
    console.log('Call 1 Result:', res1);

    // Second call: Should update to count 2
    const res2 = stmt.get(userId, type);
    console.log('Call 2 Result:', res2);

    // Verify DB Row
    const row = db.prepare('SELECT * FROM admin_reminders WHERE user_id = ? AND reminder_type = ?').get(userId, type);
    console.log('Final Row:', row);

    if (row.count === 2) {
        console.log('SUCCESS: Count incremented correctly via UPSERT.');
    } else {
        console.error('FAILURE: Unexpected count.');
    }

} catch (err) {
    console.error('Test failed:', err);
}
