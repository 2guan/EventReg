import { db } from './server/db.js';

const enrollments = db.prepare('SELECT * FROM enrollments').all();
console.log('Enrollments:', enrollments);

const matches = db.prepare('SELECT * FROM matches').all();
console.log('Matches:', matches);
