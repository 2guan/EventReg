import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db } from '../db.js';
import { verifyToken } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'sportsreg_secret_key';

// 头像上传配置
const uploadDir = path.resolve(__dirname, '../../dist/static/face/uploads');
// 确保上传目录存在
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, 'avatar-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB限制
    fileFilter: function (req, file, cb) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('只允许上传图片文件'), false);
        }
    }
});

// REGISTER
router.post('/register', (req, res) => {
    const { username, password, nickname, avatar } = req.body;
    if (!username || !password || !nickname) {
        return res.status(400).json({ error: 'Missing fields' });
    }

    try {
        const hash = bcrypt.hashSync(password, 10);

        // Get default role setting
        let defaultRole = 'pending';
        try {
            const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('default_role');
            if (setting) defaultRole = setting.value;
        } catch (e) {
            console.error('Failed to read default_role setting', e);
        }

        const stmt = db.prepare('INSERT INTO users (username, password, nickname, avatar, role) VALUES (?, ?, ?, ?, ?)');
        const info = stmt.run(username, hash, nickname, avatar || '/sportsreg/face/defaultface-user.jpg', defaultRole);

        // Auto login after register or just return success?
        res.json({ success: true, userId: info.lastInsertRowid });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

// 上传头像API
router.post('/upload-avatar', upload.single('avatar'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有上传文件' });
        }

        // 返回头像的永久URL（相对路径）
        const avatarUrl = `/sportsreg/face/uploads/${req.file.filename}`;

        res.json({
            success: true,
            avatarUrl: avatarUrl,
            filename: req.file.filename
        });
    } catch (err) {
        console.error('头像上传失败:', err);
        res.status(500).json({ error: '头像上传失败' });
    }
});

// LOGIN
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    const user = stmt.get(username);

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    if (!bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.role === 'pending') {
        return res.status(403).json({ error: 'Account pending approval' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    // Calculate total points
    const pointsStmt = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM points WHERE user_id = ?');
    const points = pointsStmt.get(user.id);

    res.json({
        token,
        user: {
            id: user.id,
            username: user.username,
            nickname: user.nickname,
            avatar: user.avatar,
            role: user.role,
            points: points ? points.total : 0
        }
    });
});

// ME
router.get('/me', verifyToken, (req, res) => {
    const stmt = db.prepare(`
        SELECT u.id, u.username, u.nickname, u.avatar, u.role, 
        COALESCE(SUM(p.amount), 0) as points
        FROM users u
        LEFT JOIN points p ON u.id = p.user_id
        WHERE u.id = ?
        GROUP BY u.id
    `);
    const user = stmt.get(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
});

// UPDATE PROFILE (Self)
router.put('/update', verifyToken, (req, res) => {
    const { nickname, avatar, password } = req.body;
    const userId = req.userId;

    try {
        let sql = 'UPDATE users SET nickname = ?, avatar = ?';
        let params = [nickname, avatar];

        if (password && password.trim() !== '') {
            const hash = bcrypt.hashSync(password, 10);
            sql += ', password = ?';
            params.push(hash);
        }

        sql += ' WHERE id = ?';
        params.push(userId);

        const stmt = db.prepare(sql);
        stmt.run(...params);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// WECHAT LOGIN
router.post('/wx-login', async (req, res) => {
    const { code, nickname, avatar } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Missing code' });
    }

    try {
        // 微信小程序配置
        const APPID = process.env.WX_APPID || '';
        const SECRET = process.env.WX_SECRET || '';

        // 如果没有配置微信参数，使用模拟模式
        if (!APPID || !SECRET) {
            // 模拟模式：使用code作为openid
            const openid = 'wx_' + code;

            // 查找是否已存在该用户
            const existingUser = db.prepare('SELECT * FROM users WHERE open_id = ?').get(openid);

            if (existingUser) {
                // 用户已存在，更新头像（如果提供了新头像）
                if (avatar && avatar !== existingUser.avatar) {
                    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, existingUser.id);
                    existingUser.avatar = avatar;
                }

                if (existingUser.role === 'pending') {
                    return res.status(403).json({ error: 'Account pending approval' });
                }

                const token = jwt.sign({ id: existingUser.id, role: existingUser.role }, JWT_SECRET, { expiresIn: '7d' });

                // 计算总积分
                const pointsStmt = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM points WHERE user_id = ?');
                const points = pointsStmt.get(existingUser.id);

                return res.json({
                    token,
                    user: {
                        id: existingUser.id,
                        username: existingUser.username,
                        nickname: existingUser.nickname,
                        avatar: existingUser.avatar,
                        role: existingUser.role,
                        points: points ? points.total : 0
                    }
                });
            } else {
                // 用户不存在，检查是否提供了头像和昵称
                if (!nickname) {
                    // 没有提供昵称，返回需要注册，让前端获取头像昵称后再注册
                    return res.json({
                        needRegister: true,
                        openid: openid
                    });
                }

                // 提供了昵称，自动注册
                const username = 'wx_' + Date.now();
                const password = bcrypt.hashSync(Math.random().toString(36).slice(-8), 10);

                // Get default role setting
                let defaultRole = 'pending';
                try {
                    const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('default_role');
                    if (setting) defaultRole = setting.value;
                } catch (e) {
                    console.error('Failed to read default_role setting', e);
                }

                const userNickname = nickname;
                // 前端已上传头像到服务器，直接使用传入的avatar，仅在没有时使用默认头像
                const userAvatar = avatar || '/sportsreg/face/defaultface-user (1).jpg';

                const stmt = db.prepare('INSERT INTO users (username, password, nickname, avatar, role, open_id) VALUES (?, ?, ?, ?, ?, ?)');
                const info = stmt.run(username, password, userNickname, userAvatar, defaultRole, openid);

                if (defaultRole === 'pending') {
                    return res.json({
                        needApproval: true,
                        userId: info.lastInsertRowid
                    });
                }

                // 自动登录
                const token = jwt.sign({ id: info.lastInsertRowid, role: defaultRole }, JWT_SECRET, { expiresIn: '7d' });

                return res.json({
                    token,
                    user: {
                        id: info.lastInsertRowid,
                        username,
                        nickname: userNickname,
                        avatar: userAvatar,
                        role: defaultRole,
                        points: 0
                    }
                });
            }
        }

        // 正式模式：调用微信API获取openid
        const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${APPID}&secret=${SECRET}&js_code=${code}&grant_type=authorization_code`;

        // 使用Node.js 18+内置fetch
        const wxRes = await fetch(wxUrl);
        const wxData = await wxRes.json();

        if (wxData.errcode) {
            return res.status(400).json({ error: wxData.errmsg || 'WeChat login failed' });
        }

        const openid = wxData.openid;

        // 查找是否已存在该用户
        const existingUser = db.prepare('SELECT * FROM users WHERE open_id = ?').get(openid);

        if (existingUser) {
            // 用户已存在，更新头像（如果提供了新头像）
            if (avatar && avatar !== existingUser.avatar) {
                db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, existingUser.id);
                existingUser.avatar = avatar;
            }

            if (existingUser.role === 'pending') {
                return res.status(403).json({ error: 'Account pending approval' });
            }

            const token = jwt.sign({ id: existingUser.id, role: existingUser.role }, JWT_SECRET, { expiresIn: '7d' });

            // 计算总积分
            const pointsStmt = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM points WHERE user_id = ?');
            const points = pointsStmt.get(existingUser.id);

            return res.json({
                token,
                user: {
                    id: existingUser.id,
                    username: existingUser.username,
                    nickname: existingUser.nickname,
                    avatar: existingUser.avatar,
                    role: existingUser.role,
                    points: points ? points.total : 0
                }
            });
        } else {
            // 用户不存在，检查是否提供了头像和昵称
            if (!nickname) {
                // 没有提供昵称，返回需要注册，让前端获取头像昵称后再注册
                return res.json({
                    needRegister: true,
                    openid: openid
                });
            }

            // 提供了昵称，自动注册
            const username = 'wx_' + Date.now();
            const password = bcrypt.hashSync(Math.random().toString(36).slice(-8), 10);

            // Get default role setting
            let defaultRole = 'pending';
            try {
                const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('default_role');
                if (setting) defaultRole = setting.value;
            } catch (e) {
                console.error('Failed to read default_role setting', e);
            }

            const userNickname = nickname;
            // 前端已上传头像到服务器，直接使用传入的avatar，仅在没有时使用默认头像
            const userAvatar = avatar || '/sportsreg/face/defaultface-user (1).jpg';

            const stmt = db.prepare('INSERT INTO users (username, password, nickname, avatar, role, open_id) VALUES (?, ?, ?, ?, ?, ?)');
            const info = stmt.run(username, password, userNickname, userAvatar, defaultRole, openid);

            if (defaultRole === 'pending') {
                return res.json({
                    needApproval: true,
                    userId: info.lastInsertRowid
                });
            }

            // 自动登录
            const token = jwt.sign({ id: info.lastInsertRowid, role: defaultRole }, JWT_SECRET, { expiresIn: '7d' });

            return res.json({
                token,
                user: {
                    id: info.lastInsertRowid,
                    username,
                    nickname: userNickname,
                    avatar: userAvatar,
                    role: defaultRole,
                    points: 0
                }
            });
        }
    } catch (err) {
        console.error('WeChat login error:', err);
        res.status(500).json({ error: err.message });
    }
});

// WECHAT REGISTER (with openid and avatar)
router.post('/wx-register', (req, res) => {
    const { openid, nickname, avatar } = req.body;

    if (!openid || !nickname) {
        return res.status(400).json({ error: 'Missing fields' });
    }

    try {
        // 生成随机用户名和密码
        const username = 'wx_' + Date.now();
        const password = bcrypt.hashSync(Math.random().toString(36).slice(-8), 10);

        // Get default role setting
        let defaultRole = 'pending';
        try {
            const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('default_role');
            if (setting) defaultRole = setting.value;
        } catch (e) {
            console.error('Failed to read default_role setting', e);
        }

        const stmt = db.prepare('INSERT INTO users (username, password, nickname, avatar, role, open_id) VALUES (?, ?, ?, ?, ?, ?)');
        const info = stmt.run(username, password, nickname, avatar || '/sportsreg/face/defaultface-user.jpg', defaultRole, openid);

        if (defaultRole === 'pending') {
            return res.json({
                success: true,
                needApproval: true,
                userId: info.lastInsertRowid
            });
        }

        // 自动登录
        const token = jwt.sign({ id: info.lastInsertRowid, role: defaultRole }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            token,
            user: {
                id: info.lastInsertRowid,
                username,
                nickname,
                avatar: avatar || '/sportsreg/face/defaultface-user.jpg',
                role: defaultRole,
                points: 0
            }
        });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'OpenID already registered' });
        }
        res.status(500).json({ error: err.message });
    }
});

// UPDATE AVATAR (for WeChat users to sync avatar)
router.put('/sync-avatar', verifyToken, (req, res) => {
    const { avatar } = req.body;
    const userId = req.userId;

    if (!avatar) {
        return res.status(400).json({ error: 'Missing avatar' });
    }

    try {
        const stmt = db.prepare('UPDATE users SET avatar = ? WHERE id = ?');
        stmt.run(avatar, userId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
