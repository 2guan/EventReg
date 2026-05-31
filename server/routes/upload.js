import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { verifyToken } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// 存储目录 - 使用 dist/static/images (持久化)
const uploadDir = path.resolve(__dirname, '../../dist/static/images');

// 确保目录存在
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 临时目录
const tempDir = path.resolve(__dirname, '../../temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, tempDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `img-${uniqueSuffix}${ext}`);
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

// 上传图片 (供活动描述等使用) - 任何已登录用户均可上传
router.post('/', verifyToken, upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有上传文件' });
        }

        const targetFilename = req.file.filename;
        const tempFilePath = req.file.path;

        // 读取临时文件
        const fileData = fs.readFileSync(tempFilePath);

        // 写入正式目录
        const finalPath = path.join(uploadDir, targetFilename);
        fs.writeFileSync(finalPath, fileData);

        // 删除临时文件
        fs.unlinkSync(tempFilePath);

        const imageUrl = `/sportsreg/images/${targetFilename}`;

        res.json({
            success: true,
            url: imageUrl,
            filename: targetFilename
        });
    } catch (err) {
        console.error('图片上传失败:', err);
        res.status(500).json({ error: '图片上传失败: ' + err.message });
    }
});

export default router;
