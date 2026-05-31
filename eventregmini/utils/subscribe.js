/**
 * 微信订阅消息工具模块
 * 用于请求用户授权和管理订阅状态
 */

const { api } = require('./api');

// 订阅消息模板ID
const TEMPLATE_ID = 'MCFmhtZXaEKfYSxEMDBJDBlqEwL7eOur4N4MEUm9Xt0';

/**
 * 请求用户授权订阅消息
 * 应在关键操作时调用（如报名成功后）
 * 
 * 注意：微信限制相同模板每次只能授权1次
 * @returns {Promise<object>} 订阅结果
 */
function requestSubscribe() {
    return new Promise((resolve, reject) => {
        // 验证用户已登录，确保使用正确的 token
        const token = wx.getStorageSync('token');
        if (!token) {
            console.log('[Subscribe] User not logged in, skipping subscription');
            resolve({ skip: true, reason: 'not_logged_in' });
            return;
        }

        // 检查是否在微信环境
        if (typeof wx === 'undefined' || !wx.requestSubscribeMessage) {
            console.log('[Subscribe] Not in WeChat environment');
            resolve({ skip: true });
            return;
        }

        wx.requestSubscribeMessage({
            tmplIds: [TEMPLATE_ID],
            success: async (res) => {
                console.log('[Subscribe] User response:', res);

                // 检查用户是否同意
                if (res[TEMPLATE_ID] === 'accept') {
                    try {
                        // 通知后端保存授权记录
                        const result = await api.notifications.subscribe(TEMPLATE_ID, 1);
                        console.log(`[Subscribe] Saved 1 subscription to backend, total: ${result.count}`);
                        resolve({ accepted: true, count: 1, total: result.count });
                    } catch (err) {
                        console.error('[Subscribe] Failed to save subscription:', err);
                        resolve({ accepted: true, count: 1, savedError: err });
                    }
                } else {
                    // 用户拒绝或取消
                    console.log('[Subscribe] User rejected or cancelled');
                    resolve({ accepted: false, status: res[TEMPLATE_ID] });
                }
            },
            fail: (err) => {
                // 常见失败原因：
                // - 用户关闭了订阅消息总开关
                // - 模板被禁用
                // - iOS端需要先调用 wx.openSetting 开启权限
                console.error('[Subscribe] Request failed:', err);

                // 不reject，避免影响主流程
                resolve({ error: err });
            }
        });
    });
}

/**
 * 静默请求订阅（不显示错误提示）
 * 适合在后台场景使用
 */
async function silentRequestSubscribe() {
    try {
        const result = await requestSubscribe();
        return result;
    } catch (err) {
        console.log('[Subscribe] Silent request failed:', err);
        return { error: err };
    }
}

/**
 * 检查用户是否已订阅
 * @returns {Promise<boolean>}
 */
async function checkSubscriptionStatus() {
    try {
        const res = await api.notifications.subscribeStatus(TEMPLATE_ID);
        return res.subscribed || false;
    } catch (err) {
        console.error('[Subscribe] Check status failed:', err);
        return false;
    }
}

module.exports = {
    requestSubscribe,
    silentRequestSubscribe,
    checkSubscriptionStatus,
    TEMPLATE_ID
};
