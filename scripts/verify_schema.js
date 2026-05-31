
import Database from 'better-sqlite3';

const db = new Database('sportsreg.db');

try {
    console.log('Checking enrollments table info...');
    const columns = db.pragma('table_info(enrollments)');
    console.log('Columns:', columns.map(c => c.name));

    const hasScore = columns.some(c => c.name === 'score');

    if (!hasScore) {
        console.log('Score column MISSING. Attempting to add...');
        db.prepare('ALTER TABLE enrollments ADD COLUMN score REAL DEFAULT 0').run();
        console.log('Score column added successfully.');
    } else {
        console.log('Score column EXISTS.');
    }
} catch (error) {
    console.error('Schema verification failed:', error);
}
