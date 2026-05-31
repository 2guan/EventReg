import { db } from './server/db.js';

console.log('Fixing avatar paths...');

const stmt = db.prepare("UPDATE users SET avatar = '/sportsreg/face/defaultface-user.jpg' WHERE avatar = '/face/defaultface-user.jpg'");
const info = stmt.run();

console.log(`Updated ${info.changes} user(s) with incorrect avatar paths.`);
console.log('Done.');
