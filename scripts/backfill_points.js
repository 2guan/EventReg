
import Database from 'better-sqlite3';

const db = new Database('sportsreg.db');

try {
    console.log('Starting Points Backfill...');

    // 1. Get all enrollments with scores
    const enrollments = db.prepare("SELECT id, user_id, match_id, score FROM enrollments WHERE status='active' AND score IS NOT NULL").all();

    console.log(`Found ${enrollments.length} enrollments with scores.`);

    const checkPoint = db.prepare('SELECT id FROM points WHERE match_id = ? AND user_id = ?');
    const insertPoint = db.prepare('INSERT INTO points (user_id, match_id, amount, reason) VALUES (?, ?, ?, ?)');
    const updatePoint = db.prepare('UPDATE points SET amount = ? WHERE id = ?');

    let added = 0;
    let updated = 0;

    db.transaction(() => {
        for (const enr of enrollments) {
            const existing = checkPoint.get(enr.match_id, enr.user_id);
            const scoreVal = parseFloat(enr.score);

            if (existing) {
                // Check if amount matches
                const currentPoint = db.prepare('SELECT amount FROM points WHERE id = ?').get(existing.id);
                if (currentPoint.amount !== scoreVal) {
                    updatePoint.run(scoreVal, existing.id);
                    updated++;
                    console.log(`Updated point for user ${enr.user_id}, match ${enr.match_id}: ${scoreVal}`);
                }
            } else {
                insertPoint.run(enr.user_id, enr.match_id, scoreVal, '活动得分');
                added++;
                console.log(`Added point for user ${enr.user_id}, match ${enr.match_id}: ${scoreVal}`);
            }
        }
    })();

    console.log(`Backfill complete. Added: ${added}, Updated: ${updated}`);

} catch (error) {
    console.error('Backfill failed:', error);
}
