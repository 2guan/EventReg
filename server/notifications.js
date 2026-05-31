import { db } from './db.js';
import { sendSubscribeMessage, WX_SUBSCRIBE_TEMPLATE_ID } from './wechat.js';

/**
 * 创建站内通知，并同步推送微信订阅消息
 * 
 * @param {number} userId - 用户ID
 * @param {string} content - 通知内容（站内消息用）
 * @param {object} activityData - 活动数据（微信推送用）
 * @param {string} activityData.title - 活动标题（预约主题）
 * @param {string} activityData.time - 活动时间（预约时间）
 * @param {string} activityData.location - 活动地点（预约地点）
 * @param {string} activityData.status - 状态：报名成功/正在候补/候补成功/转为候补/活动结算/活动取消
 * @param {string} activityData.remark - 备注（可选）
 */
export const createNotification = (userId, content, activityData = null) => {
    // Check if global notifications are enabled
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'notification_enabled'").get();
    if (setting && setting.value === 'false') {
        console.log('[NOTIFICATION] BLOCKED by global setting');
        return false; // Notifications disabled
    }

    try {
        const stmt = db.prepare('INSERT INTO notifications (user_id, content) VALUES (?, ?)');
        stmt.run(userId, content);

        // 异步发送微信订阅消息（不阻塞主流程）
        if (activityData) {
            sendWeChatNotificationAsync(userId, activityData);
        }

        return true;
    } catch (err) {
        console.error('Failed to create notification:', err);
        return false;
    }
};

/**
 * 异步发送微信订阅消息
 * 不影响主流程，失败也只记录日志
 */
async function sendWeChatNotificationAsync(userId, activityData) {
    try {
        // 检查微信推送是否已启用
        const wxPushSetting = db.prepare("SELECT value FROM settings WHERE key = 'wx_push_enabled'").get();
        if (!wxPushSetting || wxPushSetting.value !== 'true') {
            console.log('[WX_PUSH] WeChat push is disabled in settings');
            return;
        }

        // 查询用户是否有 openid（微信用户）
        const user = db.prepare('SELECT open_id FROM users WHERE id = ?').get(userId);
        if (!user || !user.open_id) {
            console.log(`[WX_PUSH] User ${userId} has no openid, skip`);
            return; // 非微信用户，不推送
        }

        // 检查用户是否有订阅次数
        const subscription = db.prepare(
            'SELECT id, count FROM wx_subscriptions WHERE user_id = ? AND template_id = ?'
        ).get(userId, WX_SUBSCRIBE_TEMPLATE_ID);

        if (!subscription || subscription.count <= 0) {
            console.log(`[WX_PUSH] User ${userId} has no subscription count for template ${WX_SUBSCRIBE_TEMPLATE_ID}`);
            return;
        }

        console.log(`[WX_PUSH] Sending to user ${userId}, openid: ${user.open_id}, remaining count: ${subscription.count}`);
        console.log(`[WX_PUSH] Activity data:`, activityData);
        console.log(`[WX_PUSH] matchId value:`, activityData.matchId, typeof activityData.matchId);

        // 构建跳转页面路径（活动详情页）- 微信要求路径以/开头
        const page = activityData.matchId
            ? `/pages/tournament-detail/tournament-detail?id=${activityData.matchId}`
            : '/pages/home/home';
        console.log(`[WX_PUSH] Page path:`, page);

        // 发送微信消息
        const result = await sendSubscribeMessage(user.open_id, activityData, page);
        console.log(`[WX_PUSH] Result for user ${userId}:`, result);

        // 如果发送成功，减少订阅计数
        if (result.errcode === 0) {
            const newCount = subscription.count - 1;
            if (newCount <= 0) {
                // 计数为0，删除记录
                db.prepare('DELETE FROM wx_subscriptions WHERE id = ?').run(subscription.id);
                console.log(`[WX_PUSH] Subscription exhausted for user ${userId}, record deleted`);
            } else {
                // 减少计数
                db.prepare('UPDATE wx_subscriptions SET count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newCount, subscription.id);
                console.log(`[WX_PUSH] Subscription count updated for user ${userId}: ${subscription.count} -> ${newCount}`);
            }
        } else if (result.errcode === 43101) {
            // 43101: user refuse to receive the message
            // 用户拒绝接收，清空订阅记录
            db.prepare('DELETE FROM wx_subscriptions WHERE id = ?').run(subscription.id);
            console.log(`[WX_PUSH] User ${userId} refused, subscription deleted`);
        }
    } catch (err) {
        console.error('[WX_PUSH] Error:', err);
    }
}

export const getNotifications = (userId) => {
    const stmt = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC');
    return stmt.all(userId);
};

export const deleteNotification = (id, userId) => {
    const stmt = db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?');
    const info = stmt.run(id, userId);
    return info.changes > 0;
};
