
import { db } from '../server/db.js';
import fs from 'fs';

console.log('Checking admin_reminders table schema...');
const output = [];
try {
    const indices = db.prepare("PRAGMA index_list('admin_reminders')").all();
    output.push('Indices: ' + JSON.stringify(indices, null, 2));

    // Also check for duplicates specifically
    const duplicates = db.prepare(`
        SELECT user_id, reminder_type, COUNT(*) as c 
        FROM admin_reminders 
        GROUP BY user_id, reminder_type 
        HAVING c > 1
    `).all();
    output.push('Duplicate Groups: ' + JSON.stringify(duplicates, null, 2));

    const allRows = db.prepare("SELECT * FROM admin_reminders").all();
    output.push('Total Rows: ' + allRows.length);
    output.push('Sample Rows: ' + JSON.stringify(allRows.slice(0, 10), null, 2));

    fs.writeFileSync('schema_result.txt', output.join('\n'));
    console.log('Done writing to schema_result.txt');

} catch (e) {
    console.error(e);
    fs.writeFileSync('schema_result.txt', 'Error: ' + e.message);
}
