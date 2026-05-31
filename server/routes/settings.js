import express from 'express';
import { db } from '../db.js';
import { verifyAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get Registration Settings
router.get('/registration', verifyAdmin, (req, res) => {
    try {
        const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
        const row = stmt.get('default_role');
        res.json({ default_role: row ? row.value : 'pending' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Registration Settings
router.put('/registration', verifyAdmin, (req, res) => {
    const { default_role } = req.body;
    if (!['pending', 'user'].includes(default_role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }

    try {
        const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
        stmt.run('default_role', default_role);
        res.json({ success: true, default_role });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
