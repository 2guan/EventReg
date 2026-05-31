
import { db } from './server/db.js';

console.log('Inspecting Schema...');

try {
    const info = db.prepare('PRAGMA table_info(enrollments)').all();
    console.log('Columns:', info.map(c => c.name));

    // Check if status exists
    const hasStatus = info.some(c => c.name === 'status');
    console.log('Has Status Column:', hasStatus);

} catch (err) {
    console.error('CRASHED:', err);
}
