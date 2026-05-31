
import { db } from './server/db.js';

console.log('Testing DB Update with SINGLE QUOTES...');

try {
    // 1. Find an active enrollment - Using single quotes
    const enrollment = db.prepare("SELECT * FROM enrollments WHERE status = 'active' LIMIT 1").get();

    if (!enrollment) {
        console.log('No active enrollments found to test.');
    } else {
        console.log('Found enrollment:', enrollment);

        // 2. Try to update it - Using single quotes
        console.log('Attempting UPDATE...');
        const stmt = db.prepare("UPDATE enrollments SET status = 'cancelled' WHERE id = ?");
        const info = stmt.run(enrollment.id);

        console.log('Update success!', info);

        // 3. Revert it
        db.prepare("UPDATE enrollments SET status = 'active' WHERE id = ?").run(enrollment.id);
        console.log('Reverted changes.');
    }

} catch (err) {
    console.error('CRASHED:', err);
}
