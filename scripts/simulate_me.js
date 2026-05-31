
import Database from 'better-sqlite3';

const db = new Database('sportsreg.db');

try {
    console.log('=== Simulate /me Points ===');
    const userId = 1;

    // Query from server/routes/auth.js
    const stmt = db.prepare(`
        SELECT u.id, u.username, u.nickname, u.avatar, u.role, 
        COALESCE(SUM(p.amount), 0) as points
        FROM users u
        LEFT JOIN points p ON u.id = p.user_id
        WHERE u.id = ?
        GROUP BY u.id
    `);

    const user = stmt.get(userId);
    console.log('User 1 /me result:', user);

    // Verify Sum manually
    const rawPoints = db.prepare('SELECT amount FROM points WHERE user_id = ?').all(userId);
    console.log('Raw Points amounts:', rawPoints.map(p => p.amount));
    console.log('Manual Sum:', rawPoints.reduce((a, b) => a + b, 0));

} catch (error) {
    console.error(error);
}
