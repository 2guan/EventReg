
import Database from 'better-sqlite3';

const db = new Database('sportsreg.db');

try {
    console.log('Force Backfill...');

    // Just get ALL enrollments with non-null score
    const enrollments = db.prepare("SELECT id, user_id, match_id, score, status FROM enrollments WHERE score IS NOT NULL AND score != ''").all();

    console.log(`Found ${enrollments.length} candidate enrollments.`);

    const checkPoint = db.prepare('SELECT id FROM points WHERE match_id = ? AND user_id = ?');
    const insertPoint = db.prepare('INSERT INTO points (user_id, match_id, amount, reason) VALUES (?, ?, ?, ?)');
    const updatePoint = db.prepare('UPDATE points SET amount = ? WHERE id = ?');

    let added = 0;
    let updated = 0;

    db.transaction(() => {
        for (const enr of enrollments) {
            // Log what we see
            console.log(`Processing Enr ${enr.id}: User ${enr.user_id}, Match ${enr.match_id}, Score ${enr.score}, Status ${enr.status}`);

            const existing = checkPoint.get(enr.match_id, enr.user_id);
            const scoreVal = parseFloat(enr.score);

            if (isNaN(scoreVal)) {
                console.log('Skipping NaN score');
                continue;
            }

            if (existing) {
                updatePoint.run(scoreVal, existing.id);
                updated++;
            } else {
                insertPoint.run(enr.user_id, enr.match_id, scoreVal, '活动得分');
                added++;
                console.log(`--> ADDED point!`);
            }
        }
    })();

    console.log(`Backfill complete. Added: ${added}, Updated: ${updated}`);

} catch (error) {
    console.error('Backfill failed:', error);
}
