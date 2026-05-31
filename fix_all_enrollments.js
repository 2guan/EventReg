import { db } from './server/db.js';

console.log('Starting Enrollment Repair...');

const matches = db.prepare('SELECT * FROM matches').all();

let totalFixed = 0;

matches.forEach(match => {
    let limit = Number(match.max_players) || 0;
    try {
        const conf = JSON.parse(match.config_json || '{}');
        if (conf.maxFieldPlayers && Number(conf.maxFieldPlayers) > 0) {
            limit = Number(conf.maxFieldPlayers);
        }
    } catch (e) { }

    console.log(`Checking Match ${match.id} (${match.title})... Limit: ${limit}`);

    // Only fix if status allows (actually, lets fix all active statuses just in case)
    if (match.status === 6) return; // Cancelled matches skipped

    const enrollments = db.prepare("SELECT id, type, user_id FROM enrollments WHERE match_id = ? AND status = 'active' ORDER BY id ASC").all(match.id);

    const updateStmt = db.prepare("UPDATE enrollments SET type = ? WHERE id = ?");

    let matchFixed = 0;
    enrollments.forEach((enr, index) => {
        const correctType = index < limit ? 'player' : 'candidate';
        if (enr.type !== correctType) {
            console.log(`[FIX] Match ${match.id} User ${enr.user_id} (Enr ${enr.id}): ${enr.type} -> ${correctType}`);
            updateStmt.run(correctType, enr.id);
            matchFixed++;
            totalFixed++;
        }
    });

    if (matchFixed > 0) {
        console.log(`-> Fixed ${matchFixed} enrollments in Match ${match.id}`);
    }
});

console.log(`Repair Complete. Total fixed: ${totalFixed}`);
