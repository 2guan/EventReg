import jwt from 'jsonwebtoken';
import { db } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'sportsreg_secret_key';

export const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    console.log(`[AUTH] Header: ${authHeader}`);
    const token = authHeader?.split(' ')[1];
    if (!token) {
        console.log('[AUTH] No token found');
        return res.status(403).json({ error: 'No token provided' });
    }

    console.log('[AUTH] Token:', token.substring(0, 10) + '...');
    console.log('[AUTH] Secret Type:', typeof JWT_SECRET);

    try {
        jwt.verify(token, String(JWT_SECRET), (err, decoded) => {
            if (err) {
                console.log('[AUTH] Verify error:', err.message);
                return res.status(401).json({ error: 'Unauthorized' });
            }
            req.userId = decoded.id;
            req.userRole = decoded.role;
            next();
        });
    } catch (tryErr) {
        console.error('[AUTH] Sync Error:', tryErr);
        return res.status(500).json({ error: 'Auth Error' });
    }
};

export const verifyAdmin = (req, res, next) => {
    verifyToken(req, res, () => {
        // 从数据库实时查询用户角色，而不是依赖token中的角色
        // 这样管理员修改角色后，用户不需要重新登录即可生效
        try {
            const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId);
            if (!user || user.role !== 'admin') {
                return res.status(403).json({ error: 'Require Admin Role' });
            }
            req.userRole = user.role; // 更新为数据库中的实际角色
            next();
        } catch (err) {
            console.error('[AUTH] DB Error:', err);
            return res.status(500).json({ error: 'Auth Error' });
        }
    });
};
