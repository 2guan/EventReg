import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db } from '../db.js';
import { verifyAdmin } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// 路径配置
const uploadsDir = path.resolve(__dirname, '../../dist/static/face/uploads');
const tempDir = path.resolve(__dirname, '../../temp');
const serverLogPath = process.env.LOG_PATH || path.resolve(__dirname, '../../server.log');

// 辅助函数：获取目录大小和文件数
function getDirStats(dirPath) {
    let totalSize = 0;
    let fileCount = 0;

    if (!fs.existsSync(dirPath)) {
        return { size: 0, count: 0 };
    }

    try {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
                totalSize += stat.size;
                fileCount++;
            }
        }
    } catch (err) {
        console.error('Error reading directory:', err);
    }

    return { size: totalSize, count: fileCount };
}

// 辅助函数：获取文件大小
function getFileSize(filePath) {
    if (!fs.existsSync(filePath)) {
        return 0;
    }
    try {
        return fs.statSync(filePath).size;
    } catch (err) {
        return 0;
    }
}

// 辅助函数：清空目录
function clearDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        return { deleted: 0 };
    }

    let deleted = 0;
    try {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
                fs.unlinkSync(filePath);
                deleted++;
            }
        }
    } catch (err) {
        console.error('Error clearing directory:', err);
    }

    return { deleted };
}

// GET /stats - 获取所有可清理数据的统计
router.get('/stats', verifyAdmin, (req, res) => {
    try {
        // 数据库统计
        const enrollmentLogs = db.prepare('SELECT COUNT(*) as count FROM enrollment_logs').get();
        const notifications = db.prepare('SELECT COUNT(*) as count FROM notifications').get();
        const wxSubscriptions = db.prepare('SELECT COUNT(*) as count FROM wx_subscriptions').get();

        // 文件统计
        const uploadsStats = getDirStats(uploadsDir);
        const tempStats = getDirStats(tempDir);
        const serverLogSize = getFileSize(serverLogPath);

        // 检查上传的头像中哪些还在使用
        let usedAvatarsCount = 0;
        if (fs.existsSync(uploadsDir)) {
            const uploadedFiles = fs.readdirSync(uploadsDir);
            for (const file of uploadedFiles) {
                // 使用 LIKE 模式匹配，更健壮地匹配头像路径（处理可能的路径格式差异）
                const userWithAvatar = db.prepare('SELECT COUNT(*) as count FROM users WHERE avatar LIKE ?').get(`%${file}`);
                if (userWithAvatar.count > 0) {
                    usedAvatarsCount++;
                }
            }
        }

        res.json({
            enrollmentLogs: enrollmentLogs.count,
            notifications: notifications.count,
            wxSubscriptions: wxSubscriptions.count,
            uploadedAvatars: {
                total: uploadsStats.count,
                totalSize: uploadsStats.size,
                unused: uploadsStats.count - usedAvatarsCount,
                used: usedAvatarsCount
            },
            tempFiles: {
                count: tempStats.count,
                size: tempStats.size
            },
            serverLog: {
                size: serverLogSize,
                exists: serverLogSize > 0
            }
        });
    } catch (err) {
        console.error('Failed to get cleanup stats:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /enrollment-logs - 清理报名日志
router.delete('/enrollment-logs', verifyAdmin, (req, res) => {
    try {
        const before = db.prepare('SELECT COUNT(*) as count FROM enrollment_logs').get();
        db.prepare('DELETE FROM enrollment_logs').run();
        res.json({ success: true, deleted: before.count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /notifications - 清理所有通知
router.delete('/notifications', verifyAdmin, (req, res) => {
    try {
        const before = db.prepare('SELECT COUNT(*) as count FROM notifications').get();
        db.prepare('DELETE FROM notifications').run();
        res.json({ success: true, deleted: before.count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /wx-subscriptions - 清理微信订阅记录
router.delete('/wx-subscriptions', verifyAdmin, (req, res) => {
    try {
        const before = db.prepare('SELECT COUNT(*) as count FROM wx_subscriptions').get();
        db.prepare('DELETE FROM wx_subscriptions').run();
        res.json({ success: true, deleted: before.count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /uploaded-avatars - 清理未使用的上传头像
router.delete('/uploaded-avatars', verifyAdmin, (req, res) => {
    try {
        if (!fs.existsSync(uploadsDir)) {
            return res.json({ success: true, deleted: 0 });
        }

        const files = fs.readdirSync(uploadsDir);
        let deleted = 0;

        for (const file of files) {
            // 使用 LIKE 模式匹配，与统计逻辑保持一致
            const userWithAvatar = db.prepare('SELECT COUNT(*) as count FROM users WHERE avatar LIKE ?').get(`%${file}`);

            // 只删除未被使用的头像
            if (userWithAvatar.count === 0) {
                const filePath = path.join(uploadsDir, file);
                fs.unlinkSync(filePath);
                deleted++;
            }
        }

        res.json({ success: true, deleted });
    } catch (err) {
        console.error('Failed to clean uploaded avatars:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /server-log - 清理服务器日志
router.delete('/server-log', verifyAdmin, (req, res) => {
    try {
        if (fs.existsSync(serverLogPath)) {
            const size = fs.statSync(serverLogPath).size;
            fs.writeFileSync(serverLogPath, ''); // 清空而不删除
            res.json({ success: true, clearedSize: size });
        } else {
            res.json({ success: true, clearedSize: 0 });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /temp-files - 清理临时文件
router.delete('/temp-files', verifyAdmin, (req, res) => {
    try {
        const result = clearDirectory(tempDir);
        res.json({ success: true, deleted: result.deleted });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /all - 清理所有内容
router.delete('/all', verifyAdmin, (req, res) => {
    try {
        const results = {};

        // 清理数据库
        const logsCount = db.prepare('SELECT COUNT(*) as count FROM enrollment_logs').get();
        db.prepare('DELETE FROM enrollment_logs').run();
        results.enrollmentLogs = logsCount.count;

        const notifsCount = db.prepare('SELECT COUNT(*) as count FROM notifications').get();
        db.prepare('DELETE FROM notifications').run();
        results.notifications = notifsCount.count;

        const wxSubsCount = db.prepare('SELECT COUNT(*) as count FROM wx_subscriptions').get();
        db.prepare('DELETE FROM wx_subscriptions').run();
        results.wxSubscriptions = wxSubsCount.count;

        // 清理未使用的头像
        if (fs.existsSync(uploadsDir)) {
            const files = fs.readdirSync(uploadsDir);
            let avatarsDeleted = 0;
            for (const file of files) {
                const avatarPath = `/sportsreg/face/uploads/${file}`;
                const userWithAvatar = db.prepare('SELECT COUNT(*) as count FROM users WHERE avatar = ?').get(avatarPath);
                if (userWithAvatar.count === 0) {
                    fs.unlinkSync(path.join(uploadsDir, file));
                    avatarsDeleted++;
                }
            }
            results.uploadedAvatars = avatarsDeleted;
        }

        // 清理临时文件
        results.tempFiles = clearDirectory(tempDir).deleted;

        // 清理服务器日志
        if (fs.existsSync(serverLogPath)) {
            results.serverLogSize = fs.statSync(serverLogPath).size;
            fs.writeFileSync(serverLogPath, '');
        }

        res.json({ success: true, results });
    } catch (err) {
        console.error('Failed to clean all:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
