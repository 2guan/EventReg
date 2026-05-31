import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { verifyAdmin } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Banner 存储目录 - 使用 dist/static/banner (在 Docker 中被挂载持久化)
const bannerDir = path.resolve(__dirname, '../../dist/static/banner');

// 确保目录存在
if (!fs.existsSync(bannerDir)) {
    fs.mkdirSync(bannerDir, { recursive: true });
}

// 配置文件上传 - 先存到临时目录
const tempDir = path.resolve(__dirname, '../../temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, tempDir);
    },
    filename: function (req, file, cb) {
        // 使用时间戳避免冲突
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `banner-temp-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB 限制
    fileFilter: function (req, file, cb) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('只允许上传图片文件 (JPEG, PNG, GIF, WebP)'), false);
        }
    }
});

// 获取所有 banner 列表 (包括默认和自定义)
router.get('/', (req, res) => {
    try {
        const banners = [];
        
        // 1. 获取自定义 banner
        const customBanners = [];
        if (fs.existsSync(bannerDir)) {
            const files = fs.readdirSync(bannerDir);
            files.forEach(file => {
                if (file.startsWith('custombanner-')) {
                    const filePath = path.join(bannerDir, file);
                    try {
                        const stats = fs.statSync(filePath);
                        customBanners.push({
                            isCustom: true,
                            filename: file,
                            url: `/sportsreg/banner/${file}`,
                            exists: true,
                            mtime: stats.mtimeMs
                        });
                    } catch (e) {
                        // 如果文件读取状态失败，至少保留基本信息
                        customBanners.push({
                            isCustom: true,
                            filename: file,
                            url: `/sportsreg/banner/${file}`,
                            exists: true,
                            mtime: 0
                        });
                    }
                }
            });
        }

        // 按照修改时间降序排列 (最新上传在前面)
        customBanners.sort((a, b) => b.mtime - a.mtime);

        // 分配 ID 并加入主列表
        let currentId = 1;
        customBanners.forEach(cb => {
            const { mtime, ...bannerData } = cb;
            banners.push({
                ...bannerData,
                id: currentId++
            });
        });

        // 2. 获取 12 个默认 banner
        for (let i = 1; i <= 12; i++) {
            const num = String(i).padStart(2, '0');
            const filename = `defaultbanner-${num}.jpg`;
            const filePath = path.join(bannerDir, filename);

            banners.push({
                id: currentId++,
                isCustom: false,
                filename: filename,
                url: `/sportsreg/banner/${filename}`,
                exists: fs.existsSync(filePath)
            });
        }

        res.json(banners);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// 注意：/custom 路由必须在 /:id 之前定义，
// 否则 Express 会将 "custom" 当作 :id 参数匹配
// =============================================

// 上传自定义 banner
router.post('/custom', verifyAdmin, upload.single('banner'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有上传文件' });
        }

        const ext = path.extname(req.file.originalname) || '.jpg';
        const targetFilename = `custombanner-${Date.now()}${ext}`;
        const tempFilePath = req.file.path;

        // 读取临时文件
        const fileData = fs.readFileSync(tempFilePath);

        // 写入 banner 目录
        const bannerPath = path.join(bannerDir, targetFilename);
        fs.writeFileSync(bannerPath, fileData);

        // 删除临时文件
        fs.unlinkSync(tempFilePath);

        console.log(`[BANNER] Uploaded custom banner - path: ${bannerPath}`);

        const bannerUrl = `/sportsreg/banner/${targetFilename}`;

        res.json({
            success: true,
            isCustom: true,
            url: bannerUrl,
            filename: targetFilename
        });
    } catch (err) {
        console.error('Custom banner 上传失败:', err);
        res.status(500).json({ error: 'Custom banner 上传失败: ' + err.message });
    }
});

// 删除自定义 banner
router.delete('/custom/:filename', verifyAdmin, (req, res) => {
    try {
        const filename = req.params.filename;
        if (!filename || !filename.startsWith('custombanner-')) {
            return res.status(400).json({ error: '无效的文件名' });
        }

        const bannerPath = path.join(bannerDir, filename);
        if (fs.existsSync(bannerPath)) {
            fs.unlinkSync(bannerPath);
            console.log(`[BANNER] Deleted custom banner - path: ${bannerPath}`);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: '文件不存在' });
        }
    } catch (err) {
        console.error('删除 banner 失败:', err);
        res.status(500).json({ error: '删除失败: ' + err.message });
    }
});

// 上传/替换指定 ID 的 banner (必须在 /custom 之后定义)
router.post('/:id', verifyAdmin, upload.single('banner'), (req, res) => {
    try {
        const bannerId = parseInt(req.params.id);

        if (bannerId < 1 || bannerId > 12) {
            return res.status(400).json({ error: 'Banner ID 必须在 1-12 之间' });
        }

        if (!req.file) {
            return res.status(400).json({ error: '没有上传文件' });
        }

        const num = String(bannerId).padStart(2, '0');
        const targetFilename = `defaultbanner-${num}.jpg`;
        const tempFilePath = req.file.path;

        // 读取临时文件
        const fileData = fs.readFileSync(tempFilePath);

        // 写入 banner 目录 (Docker 挂载持久化)
        const bannerPath = path.join(bannerDir, targetFilename);
        fs.writeFileSync(bannerPath, fileData);

        // 删除临时文件
        fs.unlinkSync(tempFilePath);

        console.log(`[BANNER] Replaced banner ${num} - path: ${bannerPath}`);

        const bannerUrl = `/sportsreg/banner/${targetFilename}`;

        res.json({
            success: true,
            id: bannerId,
            url: bannerUrl,
            filename: targetFilename
        });
    } catch (err) {
        console.error('Banner 上传失败:', err);
        res.status(500).json({ error: 'Banner 上传失败: ' + err.message });
    }
});

export default router;
