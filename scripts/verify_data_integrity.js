
import Database from 'better-sqlite3';

const db = new Database('sportsreg.db');

try {
    console.log('=== DATA INTEGRITY CHECK ===');

    // 1. Users
    console.log('\n--- Users (First 5) ---');
    const users = db.prepare('SELECT id, username, nickname FROM users LIMIT 5').all();
    console.table(users);

    // 2. Enrollments with Scores
    console.log('\n--- Enrollments with Scores ---');
    const enrollments = db.prepare('SELECT id, user_id, match_id, score FROM enrollments WHERE score IS NOT NULL').all();
    console.table(enrollments);

    // 3. Points Table
    console.log('\n--- Points Table (All) ---');
    const points = db.prepare('SELECT * FROM points').all();
    console.table(points); // Might be empty if backfill failed?

    // 4. Simulate /api/auth/me for User 1
    console.log('\n--- Simulate /api/auth/me (for User 1) ---');
    const meStmt = db.prepare(`
        SELECT u.id, u.username, u.nickname, u.role, 
        COALESCE(SUM(p.amount), 0) as points
        FROM users u
        LEFT JOIN points p ON u.id = p.user_id
        WHERE u.id = ?
        GROUP BY u.id
    `);
    const me = meStmt.get(1);
    console.log('Result:', me);

    // 5. Simulate /api/points/my/history for User 1
    console.log('\n--- Simulate /api/points/my/history (for User 1) ---');
    const history = db.prepare('SELECT * FROM points WHERE user_id = ? ORDER BY created_at DESC').all(1);
    console.table(history);

} catch (error) {
    console.error('Verification failed:', error);
}
