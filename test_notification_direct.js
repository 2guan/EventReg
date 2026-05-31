import { createNotification } from './server/notifications.js';
import { db } from './server/db.js';

console.log('Testing Notifications...');

// Ensure setting is on
db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('notification_enabled', 'true')").run();

// Create dummy user
db.prepare("INSERT OR IGNORE INTO users (id, username, password, nickname) VALUES (999, 'notif_test', 'pass', 'NotifUser')").run();

// Send
console.log('Sending notification...');
const result = createNotification(999, 'Test Message Direct');
console.log('Result:', result);

// Verify
const notifs = db.prepare('SELECT * FROM notifications WHERE user_id = 999').all();
console.log('Notifications in DB:', notifs);
