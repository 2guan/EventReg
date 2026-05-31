import express from 'express';
import { db } from '../db.js';
import { verifyToken, verifyAdmin } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /logs/enrollments - 获取报名日志
 * 查询参数:
 * - match_id: 筛选特定活动
 * - user_id: 筛选特定用户
 * - operation: 筛选操作类型 (join/cancel)
 * - limit: 返回数量限制 (默认100)
 * - offset: 偏移量 (用于分页)
 */
router.get('/enrollments', verifyAdmin, (req, res) => {
    const { match_id, user_id, operation, limit = 200, offset = 0 } = req.query;

    try {
        // 从 enrollment_logs 表读取（每次报名/取消都是独立记录）
        let query = `
            SELECT 
                el.id,
                el.created_at as record_time,
                el.enroll_time,
                el.operation,
                el.enrolled_for_name,
                u.id as user_id,
                u.username,
                u.nickname,
                m.id as match_id,
                m.title as match_title,
                m.time as match_time,
                m.duration as match_duration
            FROM enrollment_logs el
            JOIN users u ON el.user_id = u.id
            JOIN matches m ON el.match_id = m.id
            WHERE 1=1
        `;

        const params = [];

        if (match_id) {
            query += ` AND el.match_id = ?`;
            params.push(match_id);
        }

        if (user_id) {
            query += ` AND el.user_id = ?`;
            params.push(user_id);
        }

        if (operation) {
            query += ` AND el.operation = ?`;
            params.push(operation);
        }

        query += ` ORDER BY el.created_at DESC LIMIT ? OFFSET ?`;
        params.push(Number(limit), Number(offset));

        const logs = db.prepare(query).all(params);

        // 格式化返回数据
        const formattedLogs = logs.map(log => ({
            id: log.id,
            recordTime: log.record_time,
            enrollTime: log.enroll_time,
            userId: log.user_id,
            username: log.username,
            nickname: log.nickname,
            enrolledForName: log.enrolled_for_name || log.nickname,
            matchId: log.match_id,
            matchTitle: log.match_title,
            matchTime: log.match_time,
            matchDuration: log.match_duration,
            operation: log.operation
        }));

        res.json(formattedLogs);
    } catch (err) {
        console.error('[LOGS] Error fetching enrollment logs:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /logs/matches - 获取所有活动列表（用于筛选）
 */
router.get('/matches', verifyAdmin, (req, res) => {
    try {
        const matches = db.prepare('SELECT id, title, time FROM matches ORDER BY time DESC').all();
        res.json(matches);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /logs/enrollments - 清空所有日志
 */
router.delete('/enrollments', verifyAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM enrollment_logs').run();
        console.log('[LOGS] All enrollment logs cleared');
        res.json({ success: true, message: '日志已清空' });
    } catch (err) {
        console.error('[LOGS] Error clearing logs:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
