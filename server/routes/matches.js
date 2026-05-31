import express from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { verifyToken, verifyAdmin } from '../middleware/auth.js';
import { createNotification } from '../notifications.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'sportsreg_secret_key';

// 状态标准化映射表 - 统一转换为数字格式
const statusToNumber = {
    'pre-registration': 0, '0': 0, 0: 0,
    'registration': 1, '1': 1, 1: 1,
    'waiting-list': 2, '2': 2, 2: 2,
    'full': 3, '3': 3, 3: 3,
    'finished-pending': 4, '4': 4, 4: 4,
    'finished-completed': 5, '5': 5, 5: 5,
    'cancelled': 6, '6': 6, 6: 6
};

// 标准化状态值为数字
const normalizeStatus = (status) => {
    const key = typeof status === 'string' ? status : String(status);
    const num = statusToNumber[key];
    return num !== undefined ? num : status;
};

// LIST MATCHES (Public)
router.get('/', (req, res) => {
    let isAdmin = false;
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];
    if (token) {
        try {
            const decoded = jwt.verify(token, String(JWT_SECRET));
            const user = db.prepare('SELECT role FROM users WHERE id = ?').get(decoded.id);
            if (user && user.role === 'admin') {
                isAdmin = true;
            }
        } catch (e) {
            // 忽略错误，按普通用户处理
        }
    }

    const showAll = isAdmin && req.query.source === 'admin';

    let sql = `
        SELECT m.*,
        (SELECT COUNT(*) FROM enrollments e WHERE e.match_id = m.id AND e.type = 'player' AND e.status = 'active') as registered_count,
        (SELECT COUNT(*) FROM enrollments e WHERE e.match_id = m.id AND e.type = 'candidate' AND e.status = 'active') as waitlist_count
        FROM matches m
    `;

    if (showAll) {
        // 管理中心：可见所有活动
    } else if (isAdmin) {
        // 管理员在普通页面（首页、全部活动）：过滤完全隐藏
        sql += " WHERE m.visibility IS NULL OR m.visibility != 'fully_hidden'";
    } else {
        // 普通用户在普通页面（首页、全部活动）：过滤完全隐藏、用户隐藏
        sql += " WHERE m.visibility IS NULL OR m.visibility = 'public'";
    }

    sql += `
        ORDER BY 
            CASE WHEN strftime('%s', m.time) >= strftime('%s', 'now') THEN 0 ELSE 1 END ASC,
            CASE WHEN strftime('%s', m.time) >= strftime('%s', 'now') THEN m.time ELSE NULL END ASC,
            m.time DESC
    `;

    const stmt = db.prepare(sql);
    const matches = stmt.all();
    res.json(matches);
});

// GET MATCH (Public)
router.get('/:id', (req, res) => {
    const stmt = db.prepare('SELECT * FROM matches WHERE id = ?');
    const match = stmt.get(req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json(match);
});

// CREATE MATCH (Admin)
router.post('/', verifyAdmin, (req, res) => {
    const {
        title, description, time, location,
        max_players, max_waitlist, duration,
        status, config_json, proxy_limit, visibility
    } = req.body;

    try {
        const stmt = db.prepare(`
      INSERT INTO matches (
        title, description, time, location,
        max_players, max_waitlist, duration,
        status, config_json, proxy_limit, visibility
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const info = stmt.run(
            title, description, time, location,
            max_players, max_waitlist || 0, duration || 90,
            status || 0, config_json || '{}',
            proxy_limit === undefined ? 2 : Number(proxy_limit),
            visibility || 'public'
        );
        res.json({ success: true, id: info.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE MATCH (Admin)
router.put('/:id', verifyAdmin, (req, res) => {
    const {
        title, description, time, location,
        max_players, max_waitlist, duration,
        status, config_json, proxy_limit, visibility
    } = req.body;
    const { id } = req.params;

    try {
        // Get old match data to preserve config fields
        const oldMatch = db.prepare('SELECT status, title, config_json FROM matches WHERE id = ?').get(id);
        if (!oldMatch) {
            return res.status(404).json({ error: 'Match not found' });
        }
        const oldStatus = oldMatch.status;

        // 合并 config_json: 保留原有字段（如 locked），但允许新字段覆盖
        let mergedConfig = {};
        try {
            // 解析原有配置
            const existingConfig = JSON.parse(oldMatch.config_json || '{}');
            // 解析新配置
            const newConfig = JSON.parse(config_json || '{}');
            // 合并：先展开原有配置，再覆盖新配置
            mergedConfig = { ...existingConfig, ...newConfig };
            console.log(`[UPDATE MATCH] Merged config. Preserved fields:`, Object.keys(existingConfig).filter(k => !(k in newConfig)));
        } catch (e) {
            console.warn('[UPDATE MATCH] Config merge failed, using new config:', e);
            mergedConfig = JSON.parse(config_json || '{}');
        }
        const finalConfigJson = JSON.stringify(mergedConfig);

        const stmt = db.prepare(`
      UPDATE matches SET
        title = ?, description = ?, time = ?, location = ?,
        max_players = ?, max_waitlist = ?, duration = ?,
        status = ?, config_json = ?, proxy_limit = ?, visibility = ?
      WHERE id = ?
    `);

        // 标准化状态为数字格式，确保 H5 和小程序发送的状态一致
        const normalizedOldStatus = normalizeStatus(oldStatus);
        const normalizedNewStatus = normalizeStatus(status);

        console.log(`[UPDATE MATCH] ID: ${id}`);
        console.log(`[UPDATE MATCH] Old Status: ${oldStatus} -> normalized: ${normalizedOldStatus}`);
        console.log(`[UPDATE MATCH] New Status: ${status} -> normalized: ${normalizedNewStatus}`);

        // 使用标准化后的数字状态和合并后的配置存储
        stmt.run(
            title, description, time, location,
            max_players, max_waitlist, duration,
            normalizedNewStatus, finalConfigJson,
            proxy_limit === undefined ? 2 : Number(proxy_limit),
            visibility || 'public',
            id
        );

        // Notification Triggers & Re-calculation - 使用标准化后的数字进行比较
        const oldNum = normalizedOldStatus;
        const newNum = normalizedNewStatus;

        console.log(`[UPDATE MATCH] Checking triggers. Old: ${oldNum}, New: ${newNum}`);

        // 1. Pre-registration -> Registration (0 -> 1)
        if (oldNum === 0 && newNum === 1) {
            console.log('[UPDATE MATCH] Trigger: Pre-registration -> Registration');

            const reCalcTx = db.transaction(() => {
                console.log('[UPDATE MATCH] Inside reCalcTx transaction (Start).');
                try {
                    let limit = Number(max_players) || 0;
                    try {
                        const conf = JSON.parse(config_json || '{}');
                        if (conf.maxFieldPlayers && Number(conf.maxFieldPlayers) > 0) {
                            limit = Number(conf.maxFieldPlayers);
                        }
                    } catch (e) { }

                    // Get all enrollments ordered by ID (FCFS)
                    const allEnrollments = db.prepare("SELECT id, type, user_id, enrolled_for_name FROM enrollments WHERE match_id = ? AND status = 'active' ORDER BY id ASC").all(id);

                    const updateTypeStmt = db.prepare("UPDATE enrollments SET type = ? WHERE id = ?");

                    allEnrollments.forEach((enr, index) => {
                        const newType = index < limit ? 'player' : 'candidate';

                        // Always update type to be sure
                        if (enr.type !== newType) {
                            updateTypeStmt.run(newType, enr.id);
                        }

                        // Send Notification (Always send for start of registration, or just for players?)
                        // "Pre-reg to Reg" means everyone gets notified they are "In" or "Waitlisted".
                        const user = db.prepare('SELECT nickname FROM users WHERE id = ?').get(enr.user_id);
                        const userNickname = user ? user.nickname : '用户';
                        // 姓名格式：本人报名显示昵称，代报名显示"被报名人（代报人代报名）"
                        const displayName = enr.enrolled_for_name
                            ? `${enr.enrolled_for_name}（${userNickname}代报名）`
                            : userNickname;

                        if (newType === 'player') {
                            createNotification(enr.user_id, `${displayName}，您好，您报名的${title}活动，已经开始正式报名，您当前在上场名单中，请您及时参加。`, {
                                matchId: id,
                                title: title,
                                time: time,
                                location: location,
                                name: displayName,
                                progress: '【报名成功】请您按时参加活动。'
                            });
                        } else {
                            createNotification(enr.user_id, `${displayName}，您好，您报名的${title}活动，已经开始正式报名，您当前在候补名单中，请您随时关注。`, {
                                matchId: id,
                                title: title,
                                time: time,
                                location: location,
                                name: displayName,
                                progress: '【正在候补】请您随时关注报名动态。'
                            });
                        }
                    });
                } catch (txErr) {
                    console.error('[UPDATE MATCH] ReCalc Error:', txErr);
                    throw txErr;
                }
            });
            try { reCalcTx(); } catch (e) { console.error(e); }
        }

        // 2. Registration Update (Limit Change / Re-shuffle) - RUNS ALWAYS if in registration
        // Status 1 -> 1 (or 2 -> 1, 1 -> 2, or 2->2)
        // OR Status transition 0->1 is also covered? No, 0->1 notification message is specific ("Started").
        // This block handles "Adjustments" (Moved to waitlist / Promoted).

        // Only run this if we are CURRENTLY/NEWLY in registration/waitlist state
        // AND it's NOT the 0->1 transition (which sends "User X, join now" notification).
        // If it is 0->1, we handled it above.
        // We want to handle 1->1, 1->2, 2->1, 2->2.

        const isRegOrWait = (s) => s === 1 || s === 2;

        if (isRegOrWait(newNum) && isRegOrWait(oldNum)) {
            console.log('[UPDATE MATCH] Trigger: Registration Update (Possible Limit Change)');
            console.log(`[UPDATE MATCH] Old Limit Logic Check. MaxPlayers: ${max_players}, Config: ${config_json}`);

            const reCalcTx = db.transaction(() => {
                console.log('[UPDATE MATCH] Inside reCalcTx transaction (Update).');
                try {
                    let limit = Number(max_players) || 0;
                    try {
                        const conf = JSON.parse(config_json || '{}');
                        console.log('[UPDATE MATCH] Parsed Config:', conf);
                        if (conf.maxFieldPlayers && Number(conf.maxFieldPlayers) > 0) {
                            limit = Number(conf.maxFieldPlayers);
                        }
                    } catch (e) { console.error('[UPDATE MATCH] JSON Parse Error:', e); }
                    console.log(`[UPDATE MATCH] Effective Limit: ${limit}`);

                    // Get all enrollments ordered by ID (deterministic)
                    const allEnrollments = db.prepare("SELECT id, type, user_id, enrolled_for_name FROM enrollments WHERE match_id = ? AND status = 'active' ORDER BY id ASC").all(id);
                    console.log(`[UPDATE MATCH] Checking ${allEnrollments.length} enrollments against limit ${limit}`);

                    const updateTypeStmt = db.prepare("UPDATE enrollments SET type = ? WHERE id = ?");

                    allEnrollments.forEach((enr, index) => {
                        // index is 0-based.
                        // If limit is 5: indices 0,1,2,3,4 are players. Index 5 is candidate.
                        const newType = index < limit ? 'player' : 'candidate';

                        console.log(`[UPDATE MATCH] User ${enr.user_id} (Index ${index}): Current=${enr.type}, New=${newType}`);

                        if (enr.type !== newType) {
                            console.log(`[UPDATE MATCH] >>> CHANGE DETECTED ID ${enr.id}: ${enr.type} -> ${newType}`);
                            updateTypeStmt.run(newType, enr.id);

                            // Send Notification for Change
                            const user = db.prepare('SELECT nickname FROM users WHERE id = ?').get(enr.user_id);
                            const userNickname = user ? user.nickname : '用户';
                            // 姓名格式：本人报名显示昵称，代报名显示"被报名人（代报人代报名）"
                            const displayName = enr.enrolled_for_name
                                ? `${enr.enrolled_for_name}（${userNickname}代报名）`
                                : userNickname;
                            let sent = false;

                            if (enr.type === 'player' && newType === 'candidate') {
                                console.log(`[UPDATE MATCH] Sending Player->Candidate notification to User ${enr.user_id}`);
                                sent = createNotification(enr.user_id, `${displayName}，您好，您报名的${title}活动，由于活动场地原因，您当前在候补名单中，请您随时关注。`, {
                                    matchId: id,
                                    title: title,
                                    time: time,
                                    location: location,
                                    name: displayName,
                                    progress: '【转为候补】场地原因，请您随时关注。'
                                });
                            } else if (enr.type === 'candidate' && newType === 'player') {
                                console.log(`[UPDATE MATCH] Sending Candidate->Player notification to User ${enr.user_id}`);
                                sent = createNotification(enr.user_id, `${displayName}，恭喜！候补成功！您报名的${title}活动，候补成功，请您及时参加。`, {
                                    matchId: id,
                                    title: title,
                                    time: time,
                                    location: location,
                                    name: displayName,
                                    progress: '【候补成功】请您按时参加活动。'
                                });
                            }
                            console.log(`[UPDATE MATCH] Notification Sent? ${sent}`);
                        }
                    });
                } catch (txErr) {
                    console.error('[UPDATE MATCH] ReCalc Error:', txErr);
                    throw txErr;
                }
            });
            try { reCalcTx(); } catch (e) { console.error(e); }
        }

        // 5. -> Pending Settlement (4) (Only if changed)
        if (oldNum !== newNum && newNum === 4) {
            console.log('[UPDATE MATCH] Trigger: -> Pending Settlement');
            // ... notification ...
            const enrollments = db.prepare(`SELECT e.user_id, e.type, e.enrolled_for_name, u.nickname FROM enrollments e JOIN users u ON e.user_id = u.id WHERE e.match_id = ? AND e.status = 'active'`).all(id);
            enrollments.forEach(e => {
                if (e.type === 'player') {
                    // 姓名格式：本人报名显示昵称，代报名显示"被报名人（代报人代报名）"
                    const displayName = e.enrolled_for_name
                        ? `${e.enrolled_for_name}（${e.nickname || '用户'}代报名）`
                        : (e.nickname || '用户');
                    createNotification(e.user_id, `${displayName}，您好，您报名的${title}活动已完成活动，请您留意付款金额，及时付款，并留意积分变化。`, {
                        matchId: id,
                        title: title,
                        time: time,
                        location: location,
                        name: displayName,
                        progress: '【活动结算】请您关注本次花费。'
                    });
                }
            });
        }

        // 6. -> Cancelled (6) (Only if changed)
        if (oldNum !== newNum && newNum === 6) {
            console.log('[UPDATE MATCH] Trigger: -> Cancelled');
            // ... notification ...
            const enrollments = db.prepare(`SELECT e.user_id, e.type, e.enrolled_for_name, u.nickname FROM enrollments e JOIN users u ON e.user_id = u.id WHERE e.match_id = ? AND e.status = 'active'`).all(id);
            enrollments.forEach(e => {
                // 姓名格式：本人报名显示昵称，代报名显示"被报名人（代报人代报名）"
                const displayName = e.enrolled_for_name
                    ? `${e.enrolled_for_name}（${e.nickname || '用户'}代报名）`
                    : (e.nickname || '用户');
                createNotification(e.user_id, `${displayName}，很遗憾，您报名的${title}活动已取消，请您留意后续活动活动。`, {
                    matchId: id,
                    title: title,
                    time: time,
                    location: location,
                    name: displayName,
                    progress: '【活动取消】敬请期待下次活动！'
                });
            });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[UPDATE MATCH] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// TOGGLE LOCK (Admin) - 切换活动锁定状态（三级）
router.patch('/:id/lock', verifyAdmin, (req, res) => {
    const { lockState } = req.body; // 0=未锁定, 1=基本锁定, 2=完全锁定
    const { id } = req.params;

    try {
        // 获取当前 match
        const match = db.prepare('SELECT config_json, status FROM matches WHERE id = ?').get(id);
        if (!match) {
            return res.status(404).json({ error: 'Match not found' });
        }

        // 只允许在正式报名状态(1)下锁定
        const statusStr = String(match.status);
        if (statusStr !== '1' && statusStr !== 'registration') {
            return res.status(400).json({ error: '只能在正式报名状态下锁定活动' });
        }

        // 验证 lockState 参数
        if (lockState !== 0 && lockState !== 1 && lockState !== 2) {
            return res.status(400).json({ error: '无效的锁定状态，必须为 0、1 或 2' });
        }

        // 解析并更新 config_json
        let config = {};
        try {
            config = JSON.parse(match.config_json || '{}');
        } catch (e) { }

        config.locked = lockState;

        // 保存
        const stmt = db.prepare('UPDATE matches SET config_json = ? WHERE id = ?');
        stmt.run(JSON.stringify(config), id);

        const lockStateText = lockState === 0 ? '未锁定' : lockState === 1 ? '基本锁定' : '完全锁定';
        console.log(`[LOCK] Match ${id} lock state: ${lockState} (${lockStateText})`);
        res.json({ success: true, lockState: config.locked });
    } catch (err) {
        console.error('[LOCK] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// SEND MATCH START REMINDER (Admin) - 发送开始提醒
router.post('/:id/start-reminder', verifyAdmin, (req, res) => {
    const { id } = req.params;

    try {
        // 获取活动信息
        const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(id);
        if (!match) {
            return res.status(404).json({ error: 'Match not found' });
        }

        // 获取所有上场人员（type = 'player' 且 status = 'active'）
        const players = db.prepare(`
            SELECT e.user_id, e.enrolled_for_name, u.nickname 
            FROM enrollments e 
            JOIN users u ON e.user_id = u.id 
            WHERE e.match_id = ? AND e.type = 'player' AND e.status = 'active'
        `).all(id);

        if (players.length === 0) {
            return res.status(400).json({ error: '没有上场人员，无法发送提醒' });
        }

        // 为每个上场人员发送通知
        let sentCount = 0;
        players.forEach(player => {
            // 姓名格式：本人报名显示昵称，代报名显示"被报名人（代报人代报名）"
            const displayName = player.enrolled_for_name
                ? `${player.enrolled_for_name}（${player.nickname}代报名）`
                : player.nickname;

            // 发送站内通知和微信推送
            const sent = createNotification(
                player.user_id,
                `${displayName}，您报名的${match.title}活动马上就要开始了，请您及时参加。`,
                {
                    matchId: match.id,
                    title: match.title,
                    time: match.time,
                    location: match.location,
                    name: displayName,
                    progress: '【活动即将开始】请您准时参加。'
                }
            );

            if (sent) sentCount++;
        });

        console.log(`[START REMINDER] Match ${id} (${match.title}): Sent to ${sentCount}/${players.length} players`);
        res.json({
            success: true,
            sentCount,
            totalPlayers: players.length,
            message: `已向 ${sentCount} 位上场人员发送开始提醒`
        });
    } catch (err) {
        console.error('[START REMINDER] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE MATCH (Admin)
router.delete('/:id', verifyAdmin, (req, res) => {
    const { id } = req.params;
    console.log(`[DELETE MATCH] ID: ${id}`);
    try {
        // 使用事务确保原子性
        const tx = db.transaction(() => {
            // 1. 删除报名日志
            const deleteEnrollmentLogs = db.prepare('DELETE FROM enrollment_logs WHERE match_id = ?');
            const logsResult = deleteEnrollmentLogs.run(id);
            console.log(`[DELETE MATCH] Deleted ${logsResult.changes} enrollment logs`);

            // 2. 删除积分记录
            const deletePoints = db.prepare('DELETE FROM points WHERE match_id = ?');
            const pointsResult = deletePoints.run(id);
            console.log(`[DELETE MATCH] Deleted ${pointsResult.changes} points records`);

            // 3. 删除报名记录
            const deleteEnrollments = db.prepare('DELETE FROM enrollments WHERE match_id = ?');
            const enrollmentsResult = deleteEnrollments.run(id);
            console.log(`[DELETE MATCH] Deleted ${enrollmentsResult.changes} enrollments`);

            // 4. 最后删除活动本身
            const stmt = db.prepare('DELETE FROM matches WHERE id = ?');
            stmt.run(id);
        });
        tx();

        console.log(`[DELETE MATCH] Success: ${id}`);
        res.json({ success: true });
    } catch (err) {
        console.error('[DELETE MATCH] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
