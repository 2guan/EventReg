import express from 'express';
import { db } from '../db.js';
import { verifyToken, verifyAdmin } from '../middleware/auth.js';
import { getNotifications, deleteNotification } from '../notifications.js';

const router = express.Router();

// GET / - List notifications for current user
router.get('/', verifyToken, (req, res) => {
    try {
        const notifications = getNotifications(req.userId);
        res.json(notifications);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /read-all - Mark all notifications as read
// NOTE: 必须放在 /:id 之前，否则会被参数路由捕获
router.post('/read-all', verifyToken, (req, res) => {
    try {
        db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.userId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /delete-all - Delete all notifications for current user
// NOTE: 必须放在 /:id 之前，否则会被参数路由捕获
router.delete('/delete-all', verifyToken, (req, res) => {
    try {
        db.prepare('DELETE FROM notifications WHERE user_id = ?').run(req.userId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /:id - Delete a notification
router.delete('/:id', verifyToken, (req, res) => {
    try {
        const success = deleteNotification(req.params.id, req.userId);
        if (success) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Notification not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /:id/read - Mark a notification as read
router.post('/:id/read', verifyToken, (req, res) => {
    try {
        const result = db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
        if (result.changes > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Notification not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /settings - Check if global notifications are enabled (Admin)
router.get('/settings', verifyAdmin, (req, res) => {
    try {
        const setting = db.prepare("SELECT value FROM settings WHERE key = 'notification_enabled'").get();
        res.json({ enabled: setting ? setting.value === 'true' : true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /settings - Toggle global notifications (Admin)
router.post('/settings', verifyAdmin, (req, res) => {
    const { enabled } = req.body;
    try {
        const val = enabled ? 'true' : 'false';
        const stmt = db.prepare("INSERT INTO settings (key, value) VALUES ('notification_enabled', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
        stmt.run(val);
        res.json({ success: true, enabled });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /wx-push - Check if WeChat push is enabled (All logged-in users)
router.get('/wx-push', verifyToken, (req, res) => {
    try {
        const setting = db.prepare("SELECT value FROM settings WHERE key = 'wx_push_enabled'").get();
        res.json({ enabled: setting ? setting.value === 'true' : false });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /wx-push - Toggle WeChat push (Admin)
router.post('/wx-push', verifyAdmin, (req, res) => {
    const { enabled } = req.body;
    try {
        const val = enabled ? 'true' : 'false';
        const stmt = db.prepare("INSERT INTO settings (key, value) VALUES ('wx_push_enabled', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
        stmt.run(val);
        console.log(`[WX_PUSH] Setting updated: ${val}`);
        res.json({ success: true, enabled });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /subscribe - 保存用户订阅授权（微信小程序调用）
// 支持累积订阅次数，每次授权增加计数
router.post('/subscribe', verifyToken, (req, res) => {
    const { template_id, count = 1 } = req.body; // count: 本次授权的次数
    const userId = req.userId;

    if (!template_id) {
        return res.status(400).json({ error: 'Missing template_id' });
    }

    try {
        // 检查是否已存在记录
        const existing = db.prepare(
            'SELECT id, count FROM wx_subscriptions WHERE user_id = ? AND template_id = ?'
        ).get(userId, template_id);

        if (existing) {
            // 已存在，增加计数
            const newCount = existing.count + count;
            db.prepare(
                'UPDATE wx_subscriptions SET count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
            ).run(newCount, existing.id);
            console.log(`[WX_SUBSCRIBE] User ${userId} subscription count updated: ${existing.count} -> ${newCount}`);
            res.json({ success: true, count: newCount });
        } else {
            // 不存在，新建记录
            db.prepare(
                'INSERT INTO wx_subscriptions (user_id, template_id, count, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
            ).run(userId, template_id, count);
            console.log(`[WX_SUBSCRIBE] User ${userId} subscribed to template ${template_id}, count: ${count}`);
            res.json({ success: true, count: count });
        }
    } catch (err) {
        console.error('[WX_SUBSCRIBE] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /subscribe/status - 检查用户订阅状态
router.get('/subscribe/status', verifyToken, (req, res) => {
    const userId = req.userId;
    const templateId = req.query.template_id;

    try {
        if (templateId) {
            const sub = db.prepare('SELECT id FROM wx_subscriptions WHERE user_id = ? AND template_id = ?').get(userId, templateId);
            res.json({ subscribed: !!sub });
        } else {
            const subs = db.prepare('SELECT template_id, created_at FROM wx_subscriptions WHERE user_id = ?').all(userId);
            res.json({ subscriptions: subs });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;

