import express from 'express';
import { db } from '../db.js';
import { verifyToken, verifyAdmin } from '../middleware/auth.js';

const router = express.Router();

// LEADERBOARD (Public)
router.get('/leaderboard', (req, res) => {
    // Top 50 by sum of amount
    const stmt = db.prepare(`
    SELECT u.id, u.nickname, u.avatar, SUM(p.amount) as total_points
    FROM points p
    JOIN users u ON p.user_id = u.id
    GROUP BY u.id
    ORDER BY total_points DESC
  `);
    const list = stmt.all();
    res.json(list);
});

// MY HISTORY
router.get('/my/history', verifyToken, (req, res) => {
    // Join with matches table to get match title
    const stmt = db.prepare(`
        SELECT p.*, m.title as match_title 
        FROM points p 
        LEFT JOIN matches m ON p.match_id = m.id 
        WHERE p.user_id = ? 
        ORDER BY p.created_at DESC
    `);
    const list = stmt.all(req.userId);
    res.json(list);
});

// GRANT POINTS (Admin)
router.post('/grant', verifyAdmin, (req, res) => {
    const { user_id, amount, reason, match_id } = req.body;

    try {
        const stmt = db.prepare('INSERT INTO points (user_id, amount, reason, match_id) VALUES (?, ?, ?, ?)');
        stmt.run(user_id, amount, reason, match_id || null);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
