
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync(':memory:');
db.exec('CREATE TABLE users (name TEXT)');
db.exec("INSERT INTO users VALUES ('admin')");

const stmt = db.prepare('SELECT * FROM users WHERE name = ?');

try {
    console.log("Trying get(['admin'])...");
    console.log(stmt.get(['admin']));
    console.log("Success: Array");
} catch (e) {
    console.log("Failed: Array", e.message);
}

try {
    console.log("Trying get('admin')...");
    console.log(stmt.get('admin'));
    console.log("Success: Single Value");
} catch (e) {
    console.log("Failed: Single Value", e.message);
}


try {
    // Try named
    const stmt2 = db.prepare('SELECT * FROM users WHERE name = $name');
    console.log("Trying Named { $name: 'admin' }...");
    console.log(stmt2.get({ $name: 'admin' }));
    console.log("Success: Named");
} catch (e) {
    console.log("Failed: Named", e.message);
}

try {
  console.log('Trying get(''admin'')...');
  console.log(stmt.get('admin')); 
  console.log('Success: Single Value');
} catch (e) {
  console.log('Failed: Single Value', e.message);
}

