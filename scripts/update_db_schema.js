
import Database from 'better-sqlite3';

const db = new Database('sportsreg.db');

try {
    console.log('Checking for score column in enrollments table...');
    const tableInfo = db.pragma('table_info(enrollments)');
    const hasScore = tableInfo.some(col => col.name === 'score');

    if (!hasScore) {
        console.log('Adding score column...');
        db.prepare('ALTER TABLE enrollments ADD COLUMN score REAL DEFAULT 0').run();
        console.log('Score column added successfully.');
    } else {
        console.log('Score column already exists.');
    }
} catch (error) {
    console.error('Error updating schema:', error);
}
