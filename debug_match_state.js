import { db } from './server/db.js';
import fs from 'fs';

const out = [];

// Get the match ID (assuming 1, or find the one with title 'A' or just list all)
const matches = db.prepare("SELECT * FROM matches").all();
matches.forEach(m => {
    out.push(`[MATCH] ID:${m.id} Title:${m.title} Limit:${m.max_players} Config:${m.config_json}`);

    // Enrollments
    const enrollments = db.prepare(`
        SELECT e.id, e.user_id, u.nickname, e.type, e.status, e.enrolled_for_name
        FROM enrollments e 
        LEFT JOIN users u ON e.user_id = u.id
        WHERE e.match_id = ? AND e.status = 'active'
        ORDER BY e.id ASC
    `).all(m.id);

    out.push(`-- Enrollments (${enrollments.length}) --`);
    enrollments.forEach(e => {
        out.push(`   ID:${e.id} User:${e.user_id} (${e.nickname || e.enrolled_for_name}) Type:${e.type}`);
    });
    out.push('-----------------------------------');
});

fs.writeFileSync('debug_output.txt', out.join('\n'));
console.log('Done writing to debug_output.txt');
