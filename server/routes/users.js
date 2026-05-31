import express from 'express';
import { db } from '../db.js';
import { verifyAdmin } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

// LIST USERS (Admin)
router.get('/', verifyAdmin, (req, res) => {
    const stmt = db.prepare(`
        SELECT u.id, u.username, u.nickname, u.role, u.avatar, u.created_at, 
        COALESCE(SUM(p.amount), 0) as total_points 
        FROM users u 
        LEFT JOIN points p ON u.id = p.user_id 
        GROUP BY u.id
    `);
    const users = stmt.all();
    res.json(users);
});

// UPDATE USER DETAILS (Admin) - Nickname, Role, Avatar, Password
router.put('/:id', verifyAdmin, (req, res) => {
    const { nickname, role, avatar, password } = req.body;
    const { id } = req.params;

    try {
        const updates = [];
        const params = [];

        if (nickname !== undefined) {
            updates.push('nickname = ?');
            params.push(nickname);
        }
        if (role !== undefined) {
            updates.push('role = ?');
            params.push(role);
        }
        if (avatar !== undefined) {
            updates.push('avatar = ?');
            params.push(avatar);
        }
        if (password && password.trim() !== '') {
            const hashedPassword = bcrypt.hashSync(password, 10);
            updates.push('password = ?');
            params.push(hashedPassword);
        }

        if (updates.length === 0) {
            return res.json({ success: true, message: 'No changes detected' });
        }

        const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
        params.push(id);

        const stmt = db.prepare(sql);
        stmt.run(...params);
        res.json({ success: true });
    } catch (err) {
        console.error('Update user error:', err);
        res.status(500).json({ error: err.message });
    }
});

// UPDATE USER POINTS (Admin) - Adjustment
router.put('/:id/points', verifyAdmin, (req, res) => {
    const { totalPoints, adjustment } = req.body; // Support both target total OR direct adjustment
    const { id } = req.params;

    try {
        const tx = db.transaction(() => {
            let diff = 0;
            let reason = '';

            if (adjustment !== undefined) {
                // Direct adjustment mode
                diff = parseFloat(adjustment);
                reason = `管理员调整 (${diff > 0 ? '+' : ''}${diff})`;
            } else if (totalPoints !== undefined) {
                // Legacy target mode (keep for compatibility if needed, though we will switch frontend)
                const current = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM points WHERE user_id = ?').get(id);
                const currentTotal = current ? current.total : 0;
                diff = parseFloat(totalPoints) - currentTotal;
                reason = `管理员调整 (修正至 ${totalPoints})`;
            }

            if (diff !== 0) {
                const stmt = db.prepare('INSERT INTO points (user_id, amount, reason, match_id) VALUES (?, ?, ?, ?)');
                stmt.run(id, diff, reason, null);
            }
        });
        tx();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE USER (Admin)
router.delete('/:id', verifyAdmin, (req, res) => {
    const { id } = req.params;
    try {
        const deleteUserTx = db.transaction(() => {
            // Delete related data first (Manual Cascade)
            db.prepare('DELETE FROM notifications WHERE user_id = ?').run(id);
            db.prepare('DELETE FROM points WHERE user_id = ?').run(id);
            db.prepare('DELETE FROM enrollment_logs WHERE user_id = ?').run(id);
            db.prepare('DELETE FROM enrollments WHERE user_id = ?').run(id);

            // Delete user
            const stmt = db.prepare('DELETE FROM users WHERE id = ?');
            return stmt.run(id);
        });

        const info = deleteUserTx();

        if (info.changes > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
