
import fs from 'fs';

console.log('Node Version:', process.version);

// 1. Try better-sqlite3
try {
    console.log('Testing better-sqlite3...');
    const { default: Database } = await import('better-sqlite3');
    const db = new Database(':memory:');
    db.exec('CREATE TABLE test (id INT)');
    console.log('better-sqlite3 SUCCESS');
} catch (e) {
    console.log('better-sqlite3 FAILED:', e.message);
}

// 2. Try native node:sqlite
try {
    console.log('Testing node:sqlite...');
    // Only available in recent versions
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE test (id INT)');
    console.log('node:sqlite SUCCESS');
} catch (e) {
    console.log('node:sqlite FAILED/UNAVAILABLE:', e.message);
}
