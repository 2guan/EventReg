
import { db } from './db.js';

console.log('Debug 500 script starting...');

try {
    // Test 1: Simple Select
    console.log('Test 1: Check users table');
    const stmt = db.prepare('SELECT * FROM users LIMIT 1');
    const user = stmt.get();
    // In wrapper: get: (...args) => stmt.get(args)
    // Here args=[], stmt.get([]) should be fine.
    console.log('User found:', user);

    // Test 2: Parameterized Select (Login flow)
    console.log('Test 2: Parameterized Select');
    if (user) {
        const stmt2 = db.prepare('SELECT * FROM users WHERE username = ?');
        const u2 = stmt2.get(user.username);
        console.log('User found via param:', u2);
    }

} catch (err) {
    console.error('CRASH:', err);
}
