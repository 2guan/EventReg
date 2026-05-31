
import Database from 'better-sqlite3';

const db = new Database('sportsreg.db');

try {
    console.log('Test Score Sync...');

    // Target: Enrollment 9 (User 1, Match 3 - assumed from previous logs)
    const targetId = 9;
    const newScore = 20;

    db.transaction(() => {
        // 1. Update Enrollment
        console.log(`Updating Enrollment ${targetId} to Score ${newScore}...`);
        db.prepare('UPDATE enrollments SET score = ? WHERE id = ?').run(newScore, targetId);

        // 2. Sync Logic (Replicating backend)
        const enr = db.prepare('SELECT user_id, match_id FROM enrollments WHERE id = ?').get(targetId);
        if (!enr) throw new Error('Enrollment not found');

        const check = db.prepare('SELECT id FROM points WHERE match_id = ? AND user_id = ?').get(enr.match_id, enr.user_id);
        if (check) {
            console.log(`Updating existing point record ${check.id}...`);
            db.prepare('UPDATE points SET amount = ? WHERE id = ?').run(newScore, check.id);
        } else {
            console.log(`Inserting new point record...`);
            db.prepare('INSERT INTO points (user_id, match_id, amount, reason) VALUES (?, ?, ?, ?)').run(enr.user_id, enr.match_id, newScore, '活动得分');
        }
    })();

    // Verify
    const point = db.prepare('SELECT * FROM points WHERE user_id = 1 AND match_id = 3').get();
    console.log('Verification Result:', point);

} catch (error) {
    console.error('Test failed:', error);
}
