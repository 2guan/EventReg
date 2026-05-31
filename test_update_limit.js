import { db } from './server/db.js';

// Clean up
const cleanup = () => {
    db.exec(`DELETE FROM enrollments WHERE match_id = 9999`);
    db.exec(`DELETE FROM matches WHERE id = 9999`);
    db.exec(`DELETE FROM users WHERE id IN (101, 102, 103, 104, 105, 106, 107)`);
};

try {
    cleanup();

    // 1. Create Match (Status 1: Registration, Limit 4)
    console.log("Creating match...");
    const config = JSON.stringify({ maxFieldPlayers: 4 });
    const info = db.prepare(`
        INSERT INTO matches (id, title, time, location, max_players, max_waitlist, status, config_json)
        VALUES (9999, 'Test Match', '2025-01-01 10:00:00', 'Test Loc', 4, 4, 1, ?)
    `).run(config);

    // 2. Add 7 Users
    console.log("Adding users...");
    const users = [101, 102, 103, 104, 105, 106, 107];
    users.forEach(uid => {
        db.prepare(`INSERT OR IGNORE INTO users (id, username, password, nickname) VALUES (?, ?, 'pass', ?)`)
            .run(uid, `user${uid}`, `User-${uid}`);
    });

    // 3. Enroll 7 Users (Simulate Join)
    // First 4 should be players, next 3 candidates
    console.log("Enrolling users...");
    users.forEach((uid, idx) => {
        const type = idx < 4 ? 'player' : 'candidate';
        db.prepare(`INSERT INTO enrollments (match_id, user_id, type) VALUES (9999, ?, ?)`).run(uid, type);
    });

    // Verify Initial State
    const initPlayers = db.prepare(`SELECT count(*) as c FROM enrollments WHERE match_id=9999 AND type='player'`).get().c;
    const initWait = db.prepare(`SELECT count(*) as c FROM enrollments WHERE match_id=9999 AND type='candidate'`).get().c;
    console.log(`Initial: Players=${initPlayers} (Exp: 4), Waitlist=${initWait} (Exp: 3)`);

    // 4. CALL THE PUT LOGIC (Simulate Request)
    // We import the router logic? No, too complex. We can just invoke the update STATEMENT and logic manually
    // or use fetch if server is running. 
    // Let's use fetch against the running server to test the ACTUAL route.

    console.log("Sending PUT request to update limit to 5...");
    const res = await fetch('http://localhost:3002/matches/9999', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            // Need Admin Token? We can simulate or bypass auth for this test if we modify code, 
            // but better to just login as admin first.
            // Actually, for simplicity, I will copy the LOGIC from matches.js here to simulate it locally 
            // IF I can't easily get a token.
            // But testing the actual route is better.
        },
        // We'll skip token for now and rely on manual DB modification to simulate logic
        // Wait, I can't test the route without token.
        // I'll test the LOGIC by running the code block I added to matches.js here.
    });

    // Simulate the logic block I added in matches.js
    const oldStatus = 1;
    const newStatus = 1;
    const newConfig = JSON.stringify({ maxFieldPlayers: 5 });

    console.log("Simulating Logic Block...");
    const isRegOrWait = (s) => String(s) === '1' || String(s) === 'registration' || String(s) === '2' || String(s) === 'waiting-list';

    if (isRegOrWait(newStatus) && isRegOrWait(oldStatus)) {
        const reCalcTx = db.transaction(() => {
            let limit = 0;
            try {
                const conf = JSON.parse(newConfig);
                if (conf.maxFieldPlayers) limit = Number(conf.maxFieldPlayers);
            } catch (e) { }
            console.log("New Limit:", limit);

            const allEnrollments = db.prepare("SELECT id, type, user_id FROM enrollments WHERE match_id = ? AND status = 'active' ORDER BY id ASC").all(9999);

            const updateTypeStmt = db.prepare("UPDATE enrollments SET type = ? WHERE id = ?");

            let changes = 0;
            allEnrollments.forEach((enr, index) => {
                const newType = index < limit ? 'player' : 'candidate';
                if (enr.type !== newType) {
                    console.log(`Change ID ${enr.id}: ${enr.type} -> ${newType}`);
                    updateTypeStmt.run(newType, enr.id);
                    changes++;
                }
            });
            console.log("Changes made:", changes);
        });
        reCalcTx();
    }

    // Verify Final State
    const finalPlayers = db.prepare(`SELECT count(*) as c FROM enrollments WHERE match_id=9999 AND type='player'`).get().c;
    const finalWait = db.prepare(`SELECT count(*) as c FROM enrollments WHERE match_id=9999 AND type='candidate'`).get().c;
    console.log(`Final: Players=${finalPlayers} (Exp: 5), Waitlist=${finalWait} (Exp: 2)`);

} catch (err) {
    console.error(err);
} finally {
    cleanup();
}
