import express from 'express';
import { db } from '../db.js';
import { verifyToken, verifyAdmin } from '../middleware/auth.js';
import { createNotification } from '../notifications.js';
import { sendSubscribeMessage } from '../wechat.js';

const router = express.Router();

/**
 * 发送管理员提醒
 * @param {string} operationType - 操作类型：'join' | 'cancel'
 * @param {number} matchId - 活动ID
 * @param {number} operatorUserId - 操作者用户ID（报名/退报的人）
 * @param {string|null} enrolledForName - 代报名姓名（如果有）
 */
function sendAdminReminders(operationType, matchId, operatorUserId, enrolledForName) {
    try {
        // 1. 查询所有订阅了该类型提醒的管理员
        const admins = db.prepare(`
            SELECT ar.user_id, ar.count, u.open_id 
            FROM admin_reminders ar
            JOIN users u ON ar.user_id = u.id
            WHERE ar.reminder_type = ? AND ar.count > 0 AND u.open_id IS NOT NULL
        `).all(operationType);

        if (admins.length === 0) {
            console.log(`[ADMIN_REMINDER] No admins subscribed to ${operationType} reminders`);
            return;
        }

        // 2. 获取活动信息
        const match = db.prepare('SELECT title, time, location FROM matches WHERE id = ?').get(matchId);
        if (!match) {
            console.log(`[ADMIN_REMINDER] Match ${matchId} not found`);
            return;
        }

        // 3. 获取操作者信息（报名/退报的人）
        const operator = db.prepare('SELECT nickname FROM users WHERE id = ?').get(operatorUserId);
        const operatorNickname = operator ? operator.nickname : '用户';

        // 4. 构建姓名显示（本人昵称或"代报姓名（XX代报名）"）
        const displayName = enrolledForName
            ? `${enrolledForName}（${operatorNickname}代报名）`
            : operatorNickname;

        // 5. 获取当前北京时间并格式化为 X月X日 XX:XX
        const now = new Date();
        const beijingOffset = 8 * 60 * 60 * 1000; // 8小时的毫秒数
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
        const beijingTime = new Date(utcTime + beijingOffset);

        const month = beijingTime.getMonth() + 1;
        const day = beijingTime.getDate();
        const hours = String(beijingTime.getHours()).padStart(2, '0');
        const minutes = String(beijingTime.getMinutes()).padStart(2, '0');
        const timeStr = `${month}月${day}日 ${hours}:${minutes}`;

        // 6. 构建推送内容
        const progressText = operationType === 'join'
            ? `【报名提醒】${timeStr}报名。`
            : `【退报提醒】${timeStr}退报。`;

        console.log(`[ADMIN_REMINDER] Sending ${operationType} reminder to ${admins.length} admins for match ${matchId}`);

        // 7. 向每个订阅管理员发送推送
        admins.forEach(admin => {
            const activityData = {
                matchId: matchId,
                title: match.title,
                time: match.time,
                location: match.location,
                name: displayName,  // 姓名字段显示报名人姓名
                progress: progressText
            };

            // 发送推送（异步，不阻塞）
            sendAdminReminderAsync(admin.user_id, admin.open_id, activityData, operationType);
        });
    } catch (err) {
        console.error('[ADMIN_REMINDER] Error in sendAdminReminders:', err);
    }
}


/**
 * 异步发送管理员提醒推送
 */
async function sendAdminReminderAsync(userId, openId, activityData, reminderType) {
    try {
        // 构建跳转页面
        const page = activityData.matchId
            ? `/pages/tournament-detail/tournament-detail?id=${activityData.matchId}`
            : '/pages/home/home';

        console.log(`[ADMIN_REMINDER] Sending to admin ${userId}, type: ${reminderType}`);

        // 发送推送
        const result = await sendSubscribeMessage(openId, activityData, page);

        console.log(`[ADMIN_REMINDER] Send result for admin ${userId}:`, result);

        // 如果发送成功，减少订阅计数
        if (result.errcode === 0) {
            const sub = db.prepare('SELECT id, count FROM admin_reminders WHERE user_id = ? AND reminder_type = ?').get(userId, reminderType);
            if (sub) {
                const newCount = sub.count - 1;
                if (newCount <= 0) {
                    db.prepare('DELETE FROM admin_reminders WHERE id = ?').run(sub.id);
                    console.log(`[ADMIN_REMINDER] Subscription exhausted for admin ${userId}, type ${reminderType}, record deleted`);
                } else {
                    db.prepare('UPDATE admin_reminders SET count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newCount, sub.id);
                    console.log(`[ADMIN_REMINDER] Count updated for admin ${userId}, type ${reminderType}: ${sub.count} -> ${newCount}`);
                }
            }
        } else if (result.errcode === 43101) {
            // 43101: user refuse to receive the message (or out of quota)
            // Instead of deleting ALL subscriptions, we just decrement 1
            const sub = db.prepare('SELECT id, count FROM admin_reminders WHERE user_id = ? AND reminder_type = ?').get(userId, reminderType);
            if (sub) {
                const newCount = sub.count - 1;
                console.log(`[ADMIN_REMINDER] Admin ${userId} failed (43101), decrementing count: ${sub.count} -> ${newCount}`);
                if (newCount <= 0) {
                    db.prepare('DELETE FROM admin_reminders WHERE id = ?').run(sub.id);
                    console.log(`[ADMIN_REMINDER] Subscription exhausted (after failure) for admin ${userId}, record deleted`);
                } else {
                    db.prepare('UPDATE admin_reminders SET count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newCount, sub.id);
                }
            }
        }
    } catch (err) {
        console.error('[ADMIN_REMINDER] Error in sendAdminReminderAsync:', err);
    }
}


// 获取北京时间字符串 (UTC+8)
function getBeijingTime() {
    const now = new Date();
    // 转换为北京时间（UTC+8）
    const beijingOffset = 8 * 60 * 60 * 1000; // 8小时的毫秒数
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
    const beijingTime = new Date(utcTime + beijingOffset);

    // 手动格式化，避免使用 toISOString (会转回UTC)
    const year = beijingTime.getFullYear();
    const month = String(beijingTime.getMonth() + 1).padStart(2, '0');
    const day = String(beijingTime.getDate()).padStart(2, '0');
    const hours = String(beijingTime.getHours()).padStart(2, '0');
    const minutes = String(beijingTime.getMinutes()).padStart(2, '0');
    const seconds = String(beijingTime.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 将 UTC 时间字符串转换为北京时间字符串
function utcToBeijing(utcStr) {
    if (!utcStr) return getBeijingTime();
    // 解析 UTC 时间 (格式: "2025-12-14 14:30:00")
    const cleanStr = utcStr.replace('T', ' ').substring(0, 19);
    const date = new Date(cleanStr + 'Z'); // 添加 Z 表示 UTC

    // 转换为北京时间
    const beijingOffset = 8 * 60 * 60 * 1000;
    const beijingTime = new Date(date.getTime() + beijingOffset);

    const year = beijingTime.getUTCFullYear();
    const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(beijingTime.getUTCDate()).padStart(2, '0');
    const hours = String(beijingTime.getUTCHours()).padStart(2, '0');
    const minutes = String(beijingTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(beijingTime.getUTCSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// JOIN MATCH (User)
router.post('/join', verifyToken, (req, res) => {
    const { match_id, type, enrolled_for_name, created_at } = req.body; // type: player/candidate
    const userId = req.userId;

    // Check match status and capacity
    console.log(`[JOIN] Request: match_id=${match_id}, user_id=${userId}`);

    const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(match_id);
    if (!match) {
        console.error('[JOIN] Match not found');
        return res.status(404).json({ error: 'Match not found' });
    }

    // Determine effective limits (outside transaction for readability)
    let limit = Number(match.max_players) || 0;
    let maxWaitlist = Number(match.max_waitlist) || 0;
    try {
        const conf = JSON.parse(match.config_json || '{}');
        if (conf.maxFieldPlayers && Number(conf.maxFieldPlayers) > 0) {
            limit = Number(conf.maxFieldPlayers);
        }
        if (conf.maxWaitlist !== undefined) {
            maxWaitlist = Number(conf.maxWaitlist);
        }
    } catch (e) { }

    try {
        // 使用事务确保原子性，防止并发报名超限
        const tx = db.transaction(() => {
            // 1. 重复报名检查 & 代报名限制检查
            if (!enrolled_for_name) {
                // Self registration check
                const existing = db.prepare(`SELECT id FROM enrollments WHERE match_id = ? AND user_id = ? AND enrolled_for_name IS NULL AND status = 'active'`).get(match_id, userId);
                if (existing) {
                    throw new Error('您已经报名了该活动');
                }
            } else {
                // Proxy registration limit check
                const proxyLimit = (match.proxy_limit === undefined || match.proxy_limit === null) ? 2 : Number(match.proxy_limit);
                
                if (proxyLimit === 0) {
                    throw new Error('本活动不允许代报名');
                }
                
                const proxyCount = db.prepare(`
                    SELECT COUNT(*) as count 
                    FROM enrollments 
                    WHERE match_id = ? AND user_id = ? AND enrolled_for_name IS NOT NULL AND status = 'active'
                `).get(match_id, userId).count;
                
                if (proxyCount >= proxyLimit) {
                    throw new Error(`您的代报名次数已达上限(${proxyLimit}人)`);
                }

                // Guest duplicate check
                const existing = db.prepare(`SELECT id FROM enrollments WHERE match_id = ? AND user_id = ? AND enrolled_for_name = ? AND status = 'active'`).get(match_id, userId, enrolled_for_name);
                if (existing) {
                    throw new Error(`您已经为 ${enrolled_for_name} 报名了该活动`);
                }
            }

            // 2. 查询当前报名人数（在事务中查询保证一致性）
            const currentPlayers = db.prepare(`SELECT COUNT(*) as count FROM enrollments WHERE match_id = ? AND status = 'active' AND type = 'player'`).get(match_id).count;
            const currentCandidates = db.prepare(`SELECT COUNT(*) as count FROM enrollments WHERE match_id = ? AND status = 'active' AND type = 'candidate'`).get(match_id).count;

            // 3. 判断类型
            let finalType = 'player';
            if (currentPlayers >= limit) {
                finalType = 'candidate';
            }
            // If client requested 'candidate' explicitly, honor it
            if (type === 'candidate') {
                finalType = 'candidate';
            }

            // 4. 检查是否已满（上场名额满了，且候补名额也满了）
            if (finalType === 'candidate' && maxWaitlist > 0 && currentCandidates >= maxWaitlist) {
                throw new Error('报名人数已满，无法报名');
            }

            // 5. 插入记录
            const finalCreatedAt = created_at || new Date().toISOString().replace('T', ' ').substring(0, 19);
            const stmt = db.prepare('INSERT INTO enrollments (match_id, user_id, type, enrolled_for_name, created_at) VALUES (?, ?, ?, ?, ?)');
            const info = stmt.run(match_id, userId, finalType, enrolled_for_name || null, finalCreatedAt);

            console.log(`[JOIN] Insert successful. RowID: ${info.lastInsertRowid}, Changes: ${info.changes}, Type: ${finalType}`);

            // 6. 写入日志
            const beijingTime = getBeijingTime();
            const enrollTime = utcToBeijing(finalCreatedAt);
            db.prepare('INSERT INTO enrollment_logs (match_id, user_id, enrolled_for_name, operation, enroll_time, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
                match_id, userId, enrolled_for_name || null, 'join', enrollTime, beijingTime
            );

            return { success: true };
        });

        tx();

        // 事务外执行重新计算（这个不需要原子性保证）
        recalculateMatchEnrollments(match_id);

        // 发送管理员提醒（异步，不阻塞）
        sendAdminReminders('join', match_id, userId, enrolled_for_name);

        res.json({ success: true });

    } catch (err) {
        console.error('[JOIN] Error:', err);
        // 区分业务错误和系统错误
        if (err.message.includes('已经') || err.message.includes('已满')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: err.message, details: err.toString() });
    }
});

// Helper to re-calculate enrollments and notify (Self-healing)
function recalculateMatchEnrollments(matchId) {
    console.log(`[RECALC] Recalculating enrollments for match ${matchId}...`);
    try {
        const match = db.prepare('SELECT id, title, time, location, max_players, config_json, status FROM matches WHERE id = ?').get(matchId);
        if (!match) return;

        // Skip if not in registration/waitlist phase
        const statusStr = String(match.status);
        const isRegOrWait = (s) => s === '1' || s === 'registration' || s === '2' || s === 'waiting-list';
        if (!isRegOrWait(statusStr)) {
            console.log(`[RECALC] Match status ${statusStr} is not registration/waitlist. Skipping.`);
            return;
        }

        // Determine effective limit
        let limit = Number(match.max_players) || 0;
        try {
            const conf = JSON.parse(match.config_json || '{}');
            if (conf.maxFieldPlayers && Number(conf.maxFieldPlayers) > 0) {
                limit = Number(conf.maxFieldPlayers);
            }
        } catch (e) { }

        // Get all active enrollments sorted by created_at (Time Priority)
        const allEnrollments = db.prepare("SELECT id, type, user_id, enrolled_for_name FROM enrollments WHERE match_id = ? AND status = 'active' ORDER BY created_at ASC").all(matchId);

        const updateTypeStmt = db.prepare("UPDATE enrollments SET type = ? WHERE id = ?");

        allEnrollments.forEach((enr, index) => {
            const newType = index < limit ? 'player' : 'candidate';

            if (enr.type !== newType) {
                console.log(`[RECALC] ID ${enr.id} (${enr.user_id}) Type Change: ${enr.type} -> ${newType}`);
                updateTypeStmt.run(newType, enr.id);

                // Notification
                const user = db.prepare('SELECT nickname FROM users WHERE id = ?').get(enr.user_id);
                const userNickname = user ? user.nickname : '用户';
                // 姓名格式：本人报名显示昵称，代报名显示"被报名人（代报人代报名）"
                const displayName = enr.enrolled_for_name
                    ? `${enr.enrolled_for_name}（${userNickname}代报名）`
                    : userNickname;

                if (enr.type === 'player' && newType === 'candidate') {
                    createNotification(enr.user_id, `${displayName}，您好，您报名的${match.title}活动，由于活动场地变化，您当前在候补名单中，请您随时关注。`, {
                        matchId: match.id,
                        title: match.title,
                        time: match.time,
                        location: match.location,
                        name: displayName,
                        progress: '【转为候补】，场地原因，请您随时关注。'
                    });
                } else if (enr.type === 'candidate' && newType === 'player') {
                    createNotification(enr.user_id, `${displayName}，恭喜！候补成功！您报名的${match.title}活动，候补成功，请您及时参加。`, {
                        matchId: match.id,
                        title: match.title,
                        time: match.time,
                        location: match.location,
                        name: displayName,
                        progress: '【候补成功】，请您按时参加活动。'
                    });
                }
            }
        });

    } catch (err) {
        console.error('[RECALC] Error:', err);
    }
}

// CANCEL ENROLLMENT (User/Admin)
router.post('/cancel', verifyToken, (req, res) => {
    const { match_id, user_id, enrollment_id } = req.body;

    // Logic 1: Cancel by Enrollment ID (Preferred)
    if (enrollment_id) {
        console.log(`[CANCEL] By ID: ${enrollment_id}, User: ${req.userId}, Role: ${req.userRole}`);
        try {
            const enrollment = db.prepare('SELECT * FROM enrollments WHERE id = ?').get(enrollment_id);
            if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });

            // Permission Check
            if (req.userRole !== 'admin' && String(enrollment.user_id) !== String(req.userId)) {
                return res.status(403).json({ error: 'Forbidden' });
            }

            // 锁定检查 (非管理员才检查)
            if (req.userRole !== 'admin') {
                const match = db.prepare('SELECT config_json, status FROM matches WHERE id = ?').get(enrollment.match_id);
                if (match) {
                    let config = {};
                    try { config = JSON.parse(match.config_json || '{}'); } catch (e) { }

                    // 获取锁定状态 (0=未锁定, 1=基本锁定, 2=完全锁定)
                    const lockState = typeof config.locked === 'number' ? config.locked : (config.locked ? 1 : 0);

                    // 完全锁定(2): 只阻止上场人员取消，候补人员可以取消
                    if (lockState === 2) {
                        // 检查是否为上场人员（type='player'）
                        if (enrollment.type === 'player') {
                            console.log(`[CANCEL] Blocked: Match ${enrollment.match_id} is fully locked (state=2), user is a player`);
                            return res.status(403).json({ error: '活动已完全锁定，上场人员无法取消报名' });
                        }
                        // 候补人员（type='candidate'）可以取消，继续执行
                        console.log(`[CANCEL] Allowed: Match ${enrollment.match_id} is fully locked (state=2), but user is a waitlist candidate`);
                    }

                    // 基本锁定(1): 只有在没有候补时才拒绝上场人员取消
                    if (lockState === 1 && enrollment.type === 'player') {
                        // 检查是否有候补人员
                        const waitlistCount = db.prepare(`SELECT COUNT(*) as count FROM enrollments WHERE match_id = ? AND status = 'active' AND type = 'candidate'`).get(enrollment.match_id).count;

                        // 如果没有候补人员，拒绝取消
                        if (waitlistCount === 0) {
                            console.log(`[CANCEL] Blocked: Match ${enrollment.match_id} is locked (state=1) with no waitlist`);
                            return res.status(403).json({ error: '活动已锁定，当前无候补人员，无法取消报名' });
                        }
                    }

                    // 未锁定(0): 允许取消
                    // 候补人员在任何锁定状态下都允许取消
                }
            }

            const tx = db.transaction(() => {
                const info = db.prepare("UPDATE enrollments SET status = 'cancelled' WHERE id = ?").run(enrollment_id);
                // 写入取消日志 (记录时间用北京时间，报名时间用原始报名时间转北京时间)
                if (info.changes > 0) {
                    const beijingTime = getBeijingTime();
                    const originalEnrollTime = utcToBeijing(enrollment.created_at);
                    db.prepare('INSERT INTO enrollment_logs (match_id, user_id, enrolled_for_name, operation, enroll_time, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
                        enrollment.match_id, enrollment.user_id, enrollment.enrolled_for_name || null, 'cancel', originalEnrollTime, beijingTime
                    );
                    // Self-healing re-calc (handles promotions or shuffles)
                    recalculateMatchEnrollments(enrollment.match_id);
                }
            });
            tx();

            // 发送管理员提醒（异步，不阻塞）
            sendAdminReminders('cancel', enrollment.match_id, enrollment.user_id, enrollment.enrolled_for_name);

            return res.json({ success: true });

        } catch (err) {
            console.error('[CANCEL] Error:', err);
            return res.status(500).json({ error: err.message });
        }
    }

    // Logic 2: Cancel by Match ID + User ID (Fallback)
    if (!match_id) return res.status(400).json({ error: 'Missing match_id or enrollment_id' });

    const targetUserId = user_id || req.userId;
    if (req.userRole !== 'admin' && targetUserId !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        const tx = db.transaction(() => {
            const stmt = db.prepare(`UPDATE enrollments SET status = 'cancelled' WHERE match_id = ? AND user_id = ? AND status = 'active'`);
            const info = stmt.run(match_id, targetUserId);

            if (info.changes > 0) {
                recalculateMatchEnrollments(match_id);
            }
        });
        tx();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// MY ENROLLMENTS
router.get('/my/list', verifyToken, (req, res) => {
    const stmt = db.prepare(`
      SELECT e.*, m.title, m.description, m.duration, m.time as match_time, m.location, m.status as match_status, m.max_players, m.max_waitlist, m.config_json,
      (SELECT COUNT(*) FROM enrollments en WHERE en.match_id = m.id AND en.type = 'player' AND en.status = 'active') as registered_count,
      (SELECT COUNT(*) FROM enrollments en WHERE en.match_id = m.id AND en.type = 'candidate' AND en.status = 'active') as waitlist_count,
      (SELECT COUNT(*) + 1 FROM enrollments e2 WHERE e2.match_id = m.id AND e2.status = 'active' AND (CAST(e2.id AS INTEGER) < CAST(e.id AS INTEGER))) as my_rank
      FROM enrollments e
      JOIN matches m ON e.match_id = m.id
      WHERE e.user_id = ? AND e.status = 'active'
      ORDER BY m.time DESC
    `);
    const list = stmt.all(req.userId);
    res.json(list);
});

// MATCH ENROLLMENTS (Admin or Public?)
router.get('/:matchId', (req, res) => {
    const { matchId } = req.params;
    const stmt = db.prepare(`
      SELECT e.*, u.nickname, u.username, u.avatar,
      (SELECT amount FROM points p WHERE p.match_id = e.match_id AND p.user_id = e.user_id ORDER BY created_at DESC LIMIT 1) as point_val
      FROM enrollments e
      JOIN users u ON e.user_id = u.id
      WHERE e.match_id = ? AND e.status = 'active'
      ORDER BY e.created_at ASC
    `);
    const list = stmt.all(matchId);
    console.log(`[GET_ENROLLMENTS] Match ${matchId} count: ${list.length}`);
    if (list.length > 0) {
        console.log(`[GET_ENROLLMENTS] First item score: ${list[0].score}, point_val: ${list[0].point_val}`);
    }
    res.json(list);
});

// UPDATE SCORES (Admin)
router.post('/scores', verifyAdmin, (req, res) => {
    const { scores } = req.body; // Array of { id, score }

    if (!Array.isArray(scores)) {
        return res.status(400).json({ error: 'Invalid data format. Expected array of scores.' });
    }

    try {
        console.log('[SCORES] Received payload:', JSON.stringify(scores));
        const tx = db.transaction((items) => {
            const updateEnrollment = db.prepare('UPDATE enrollments SET score = ? WHERE id = ?');

            // Prepare statements for points sync
            const checkPoint = db.prepare('SELECT id FROM points WHERE match_id = ? AND user_id = ?');
            const updatePoint = db.prepare('UPDATE points SET amount = ? WHERE id = ?');
            const insertPoint = db.prepare('INSERT INTO points (user_id, match_id, amount, reason) VALUES (?, ?, ?, ?)');

            // Need to get match_id and user_id from enrollment to link points
            const getEnrollment = db.prepare('SELECT id, match_id, user_id, type, enrolled_for_name FROM enrollments WHERE id = ?');

            for (const item of items) {
                console.log(`[SCORES] Processing item: id=${item.id}, score=${item.score}`);
                // 1. Update Enrollment Score
                const info = updateEnrollment.run(item.score, item.id);
                console.log(`[SCORES] Enrollment update changes: ${info.changes}`);

                // 2. Sync to Points Table
                const enrollment = getEnrollment.get(item.id);
                console.log('[SCORES] Enrollment fetched:', enrollment);

                if (enrollment && enrollment.user_id) {
                    // CRITICAL CHANGE: If this is a proxy enrollment (enrolled_for_name is set),
                    // do NOT create/update points for the logged-in user (the proxy).
                    if (enrollment.enrolled_for_name) {
                        console.log(`[SCORES] Skipping points sync for proxy enrollment (Name: ${enrollment.enrolled_for_name})`);
                    } else {
                        const existingPoint = checkPoint.get(enrollment.match_id, enrollment.user_id);
                        const scoreVal = parseFloat(item.score);
                        console.log(`[SCORES] Existing point: ${existingPoint ? existingPoint.id : 'None'}, New Val: ${scoreVal}`);

                        if (existingPoint) {
                            // Update existing point record
                            updatePoint.run(scoreVal, existingPoint.id);
                            console.log('[SCORES] Updated existing point');
                        } else {
                            // Create new point record
                            const res = insertPoint.run(enrollment.user_id, enrollment.match_id, scoreVal, '活动得分');
                            console.log('[SCORES] Inserted new point, ID:', res.lastInsertRowid);
                        }
                    }
                } else {
                    console.warn('[SCORES] Enrollment NOT FOUND or missing user_id for id:', item.id);
                }
            }
        });
        tx(scores);
        res.json({ success: true, count: scores.length });
    } catch (err) {
        console.error('[SCORES] Update error:', err);
        res.status(500).json({ error: err.message });
    }
});

// EXPORT ENROLLMENTS AS CSV (Public download)
router.get('/:matchId/export', (req, res) => {
    const { matchId } = req.params;

    try {
        // Get match info
        const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
        if (!match) {
            return res.status(404).json({ error: 'Match not found' });
        }

        // Parse config
        let config = {};
        try {
            config = JSON.parse(match.config_json || '{}');
        } catch (e) { }

        // Calculate effective limit
        const limit = config.maxFieldPlayers || match.max_players || 0;

        // Status mapping
        const statusMap = {
            0: '预报名',
            1: '正式报名',
            2: '可候补',
            3: '已满员',
            4: '待结算',
            5: '已结束',
            6: '已取消',
            'pre-registration': '预报名',
            'registration': '正式报名',
            'waiting-list': '可候补',
            'full': '已满员',
            'finished-pending': '待结算',
            'finished-completed': '已结束',
            'cancelled': '已取消'
        };
        const matchStatus = statusMap[match.status] || String(match.status);

        // Format match time - split into start and end, convert to Beijing time
        let startTime = '';
        let endTime = '';

        // Helper to format datetime to Beijing time
        const formatToBeijingTime = (rawTime) => {
            if (!rawTime) return '';
            // 解析时间（存储的是北京时间，但格式可能是 ISO 或普通格式）
            let dateStr = rawTime.replace('T', ' ').substring(0, 19);
            // 检查是否已经是北京时间（没有 Z 后缀）或者是 UTC 时间
            if (rawTime.includes('Z') || rawTime.includes('+')) {
                // 是 UTC 时间，需要转换
                return utcToBeijing(rawTime).substring(0, 16);
            }
            // 假设已经是北京时间，直接格式化
            return dateStr.substring(0, 16);
        };

        if (config.start_datetime || config.startDateTime || match.time) {
            const startRaw = config.start_datetime || config.startDateTime || match.time;
            startTime = formatToBeijingTime(startRaw);
        }
        if (config.end_datetime || config.endDateTime) {
            const endRaw = config.end_datetime || config.endDateTime;
            endTime = formatToBeijingTime(endRaw);
        } else if (startTime && match.duration) {
            // Calculate end time from duration
            try {
                const startDate = new Date(startTime.replace(' ', 'T'));
                const endDate = new Date(startDate.getTime() + (match.duration || 90) * 60000);
                const y = endDate.getFullYear();
                const m = String(endDate.getMonth() + 1).padStart(2, '0');
                const d = String(endDate.getDate()).padStart(2, '0');
                const h = String(endDate.getHours()).padStart(2, '0');
                const min = String(endDate.getMinutes()).padStart(2, '0');
                endTime = `${y}-${m}-${d} ${h}:${min}`;
            } catch (e) {
                endTime = '';
            }
        }

        // Get enrollments with user info
        const enrollments = db.prepare(`
            SELECT e.*, u.nickname, u.username
            FROM enrollments e
            JOIN users u ON e.user_id = u.id
            WHERE e.match_id = ? AND e.status = 'active'
            ORDER BY e.created_at ASC
        `).all(matchId);

        // Calculate per-person cost for finished matches
        const totalCost = config.totalCost || 0;
        const playerCount = enrollments.filter(e => e.type === 'player').length;
        const perPersonCost = playerCount > 0 ? totalCost / playerCount : 0;

        // Group by user to calculate responsibility
        const userEnrollments = {};
        enrollments.forEach((e, index) => {
            const key = e.user_id;
            if (!userEnrollments[key]) {
                userEnrollments[key] = { count: 0, isPlayer: false };
            }
            // Only count if this is a player enrollment (not waitlist) for cost calculation
            if (e.type === 'player') {
                userEnrollments[key].count++;
                userEnrollments[key].isPlayer = true;
            }
        });

        // Build CSV data
        const headers = [
            '活动名称',
            '活动开始时间',
            '活动结束时间',
            '活动地点',
            '活动状态',
            '报名人用户名',
            '报名人姓名',
            '被报名人姓名',
            '报名时间',
            '报名状态',
            '分担费用',
            '分担说明'
        ];

        const rows = enrollments.map((e, index) => {
            // Determine if player or waitlist based on index
            const isOnField = index < limit;
            const enrollmentStatus = isOnField ? '上场人员' : '候补人员';

            // Format enrollment time (convert to Beijing time)
            let enrollTime = '';
            if (e.created_at) {
                enrollTime = utcToBeijing(e.created_at);
            }

            // Calculate cost share
            let costAmount = '¥0.00';
            let costNote = '';
            const isSettlement = ['待结算', '已结束'].includes(matchStatus) ||
                [4, 5, 'finished-pending', 'finished-completed'].includes(match.status);

            if (isSettlement && e.type === 'player') {
                // 如果是代报名，费用显示为0
                if (e.enrolled_for_name) {
                    costAmount = '¥0.00';
                    costNote = '';
                } else {
                    // 本人报名，显示负责的人数和总费用
                    const userInfo = userEnrollments[e.user_id];
                    const responsible = userInfo ? userInfo.count : 1;
                    const total = (perPersonCost * responsible).toFixed(2);
                    costAmount = `¥${total}`;
                    costNote = responsible > 1 ? `负责${responsible}人` : '';
                }
            }

            return [
                match.title,
                startTime,
                endTime,
                match.location,
                matchStatus,
                e.username || '',
                e.nickname || '',
                e.enrolled_for_name || e.nickname || '',  // 自己报名时显示自己的姓名
                enrollTime,
                enrollmentStatus,
                costAmount,
                costNote
            ];
        });

        // Generate CSV with BOM for Excel compatibility
        const BOM = '\uFEFF';
        const csvContent = BOM + [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\r\n');

        // Generate timestamp using Beijing time: YYYYMMDDHHmm
        const now = new Date();
        const beijingOffset = 8 * 60 * 60 * 1000;
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
        const beijingNow = new Date(utcTime + beijingOffset);
        const timestamp = beijingNow.getFullYear().toString() +
            String(beijingNow.getMonth() + 1).padStart(2, '0') +
            String(beijingNow.getDate()).padStart(2, '0') +
            String(beijingNow.getHours()).padStart(2, '0') +
            String(beijingNow.getMinutes()).padStart(2, '0');

        // Set response headers
        const filename = encodeURIComponent(`${match.title}-报名明细-${timestamp}.csv`);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${filename}`);
        res.send(csvContent);

    } catch (err) {
        console.error('[EXPORT] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;

