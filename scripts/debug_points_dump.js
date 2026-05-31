
import Database from 'better-sqlite3';

const db = new Database('sportsreg.db');

try {
    console.log('--- USERS ---');
    const users = db.prepare('SELECT id, username, nickname FROM users').all();
    console.table(users);

    console.log('--- ENROLLMENTS (Active) ---');
    const enrollments = db.prepare('SELECT id, user_id, match_id, score FROM enrollments WHERE status="active"').all();
    console.table(enrollments);

    console.log('--- POINTS ---');
    const points = db.prepare('SELECT * FROM points').all();
    console.table(points);

} catch (error) {
    console.error('Debug script failed:', error);
}
