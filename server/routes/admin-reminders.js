import express from 'express';
import { db } from '../db.js';
import { verifyToken, verifyAdmin } from '../middleware/auth.js';

const router = express.Router();

/**
 * Subscribe to admin reminders
 * POST /api/admin-reminders/subscribe
 * Body: { reminderType: 'join' | 'cancel' }
 */
router.post('/subscribe', verifyAdmin, (req, res) => {
    const { reminderType } = req.body;
    const userId = req.userId;

    // Validate reminder type
    if (!reminderType || !['join', 'cancel'].includes(reminderType)) {
        return res.status(400).json({ error: 'Invalid reminder type. Must be "join" or "cancel".' });
    }

    try {
        // Use UPSERT to atomically insert or update count
        // SQLite 3.35+ supports INSERT ... ON CONFLICT
        let newCount;
        try {
            // Try RETURNING clause first (cleaner)
            const upsertWithReturn = db.prepare(`
                INSERT INTO admin_reminders (user_id, reminder_type, count, created_at, updated_at)
                VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, reminder_type) DO UPDATE SET
                count = count + 1,
                updated_at = CURRENT_TIMESTAMP
                RETURNING count
            `);
            const row = upsertWithReturn.get(userId, reminderType);
            newCount = row.count;
        } catch (e) {
            // Fallback if RETURNING is not supported (likely syntax error)
            // Retry with standard run and then select
            db.prepare(`
                INSERT INTO admin_reminders (user_id, reminder_type, count, created_at, updated_at)
                VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, reminder_type) DO UPDATE SET
                count = count + 1,
                updated_at = CURRENT_TIMESTAMP
            `).run(userId, reminderType);

            const row = db.prepare('SELECT count FROM admin_reminders WHERE user_id = ? AND reminder_type = ?')
                .get(userId, reminderType);
            newCount = row.count;
        }

        console.log(`[ADMIN_REMINDER] Subscribed user ${userId}, type ${reminderType}, new count: ${newCount}`);
        res.json({ success: true, count: newCount });

    } catch (err) {
        console.error('[ADMIN_REMINDER] Subscribe error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Get admin reminder subscription status
 * GET /api/admin-reminders/status
 */
router.get('/status', verifyAdmin, (req, res) => {
    const userId = req.userId;

    try {
        // Get all subscriptions for this admin
        const subscriptions = db.prepare(
            'SELECT reminder_type, count FROM admin_reminders WHERE user_id = ?'
        ).all(userId);

        // Format response
        const status = {
            join: 0,
            cancel: 0
        };

        subscriptions.forEach(sub => {
            status[sub.reminder_type] = sub.count;
        });

        res.json(status);
    } catch (err) {
        console.error('[ADMIN_REMINDER] Status error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
