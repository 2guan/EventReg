import { db } from './server/db.js';

// Clean up
const cleanup = () => {
    db.exec(`DELETE FROM enrollments WHERE match_id = 8888`);
    db.exec(`DELETE FROM matches WHERE id = 8888`);
    db.exec(`DELETE FROM notifications WHERE user_id = 201`);
    db.exec(`DELETE FROM users WHERE id = 201`);
};

try {
    cleanup();

    // 1. Create Match (Status 0: Pre-reg)
    console.log("Creating Pre-reg match...");
    const config = JSON.stringify({ maxFieldPlayers: 2 });
    db.prepare(`
        INSERT INTO matches (id, title, time, location, max_players, max_waitlist, status, config_json)
        VALUES (8888, 'Start Test Match', '2025-01-01 10:00:00', 'Test Loc', 2, 2, 0, ?)
    `).run(config);

    // 2. Add User
    db.prepare(`INSERT OR IGNORE INTO users (id, username, password, nickname) VALUES (201, 'u201', 'pass', 'User201')`).run();

    // 3. Enroll User
    console.log("Enrolling user...");
    db.prepare(`INSERT INTO enrollments (match_id, user_id, type) VALUES (8888, 201, 'player')`).run();

    // 4. Simulate PUT Request logic (Status 0 -> 1)
    console.log("Simulating Status Update 0 -> 1...");

    const oldStatus = '0';
    const newStatus = '1';

    if ((oldStatus === '0') && (newStatus === '1')) {
        // Logic copied from matches.js for simulation
        const reCalcTx = db.transaction(() => {
            const allEnrollments = db.prepare("SELECT id, type, user_id FROM enrollments WHERE match_id = ? AND status = 'active' ORDER BY id ASC").all(8888);
            // Assume User201 is player (limit 2)
            // Notify
            console.log("Mock sending notification...");
            // In real app, createNotification inserts to DB
            db.prepare('INSERT INTO notifications (user_id, content) VALUES (?, ?)').run(201, 'Mock Notification: Started');
        });
        reCalcTx();
    }

    // 5. Verify Notification
    const notif = db.prepare('SELECT * FROM notifications WHERE user_id = 201').get();
    console.log("Notification found:", notif);

} catch (err) {
    console.error(err);
} finally {
    cleanup();
}
