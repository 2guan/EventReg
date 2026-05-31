import express from 'express';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { initDB } from './db.js';

// Import Routes
import authRoutes from './routes/auth.js';
import matchRoutes from './routes/matches.js';
import enrollmentRoutes from './routes/enrollments.js';
import userRoutes from './routes/users.js';
import pointRoutes from './routes/points.js';
import settingsRoutes from './routes/settings.js';
import notificationRoutes from './routes/notifications.js';
import logsRoutes from './routes/logs.js';
import bannersRoutes from './routes/banners.js';
import cleanupRoutes from './routes/cleanup.js';
import adminRemindersRoutes from './routes/admin-reminders.js';
import uploadRoutes from './routes/upload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;

// Initialize Database
initDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

import fs from 'fs';

// ... imports

// 定义MIME类型映射
const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject'
};

// Static files (Frontend) - Check if exists
const clientBuildPath = path.resolve(__dirname, '../dist/static');

// 微信消息推送 URL 验证接口 (必须在静态文件处理之前)
const WX_TOKEN = process.env.WX_TOKEN || 'Ks8mPx2nQr5vYa7bFc3jDw9eHg4iLo6u';

app.get('/sportsreg/wx', (req, res) => {
    const { signature, timestamp, nonce, echostr } = req.query;

    console.log('[WX_VERIFY] Received:', { signature, timestamp, nonce, echostr });

    // 如果没有参数，可能是浏览器访问，返回提示
    if (!signature || !timestamp || !nonce || !echostr) {
        return res.type('text/plain').send('WeChat verification endpoint. This URL is for WeChat server only.');
    }

    // 按字典序排序并拼接
    const arr = [WX_TOKEN, timestamp, nonce].sort();
    const str = arr.join('');

    // SHA1 加密
    const hash = crypto.createHash('sha1').update(str).digest('hex');

    console.log('[WX_VERIFY] Calculated hash:', hash);
    console.log('[WX_VERIFY] Expected signature:', signature);

    if (hash === signature) {
        console.log('[WX_VERIFY] Verification SUCCESS');
        // 必须返回纯文本格式的 echostr
        res.type('text/plain').send(echostr);
    } else {
        console.log('[WX_VERIFY] Verification FAILED');
        res.status(403).type('text/plain').send('Verification failed');
    }
});

// 微信消息推送接收接口 (POST)
app.post('/sportsreg/wx', (req, res) => {
    console.log('[WX_MSG] Received message:', req.body);
    // 目前只接收不处理，直接返回success
    res.type('text/plain').send('success');
});

if (fs.existsSync(clientBuildPath)) {
    app.use('/sportsreg', express.static(clientBuildPath, {
        setHeaders: (res, filePath) => {
            const ext = path.extname(filePath).toLowerCase();
            const mimeType = mimeTypes[ext];
            if (mimeType) {
                res.setHeader('Content-Type', mimeType);
            }
        }
    }));
}

// ... API routes
app.get('/sportsreg', (req, res) => {
    res.redirect('/sportsreg/');
});

app.get('/sportsreg/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

app.use('/sportsreg/api/auth', authRoutes);
app.use('/sportsreg/api/matches', matchRoutes);
app.use('/sportsreg/api/enrollments', enrollmentRoutes);
app.use('/sportsreg/api/users', userRoutes);
app.use('/sportsreg/api/points', pointRoutes);
app.use('/sportsreg/api/settings', settingsRoutes);
app.use('/sportsreg/api/notifications', notificationRoutes);
app.use('/sportsreg/api/logs', logsRoutes);
app.use('/sportsreg/api/banners', bannersRoutes);
app.use('/sportsreg/api/cleanup', cleanupRoutes);
app.use('/sportsreg/api/admin-reminders', adminRemindersRoutes);
app.use('/sportsreg/api/upload', uploadRoutes);

// Catch-all for frontend routing
app.get(/^\/sportsreg\/.*$/, (req, res) => {
    // Skip API routes
    if (req.path.startsWith('/sportsreg/api')) return res.status(404).send('API not found');

    if (fs.existsSync(path.join(clientBuildPath, 'index.html'))) {
        res.sendFile(path.join(clientBuildPath, 'index.html'));
    } else {
        res.status(404).send('Frontend build not found. In dev mode, use Vite (port 3000).');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
