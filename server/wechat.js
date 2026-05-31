/**
 * 微信小程序API工具模块
 * 用于获取access_token和发送订阅消息
 */

// 微信配置
const WX_APPID = process.env.WX_APPID || 'wx1e2e84238449c35b';
const WX_SECRET = process.env.WX_SECRET || 'd86f02a9fcfd1f24464484a28944073d';
const WX_SUBSCRIBE_TEMPLATE_ID = process.env.WX_SUBSCRIBE_TEMPLATE_ID || 'MCFmhtZXaEKfYSxEMDBJDBlqEwL7eOur4N4MEUm9Xt0';

// access_token 缓存
let accessTokenCache = {
    token: null,
    expiresAt: 0
};

/**
 * 获取微信 access_token（带缓存）
 * access_token 有效期为 2 小时，提前 5 分钟刷新
 */
export async function getAccessToken() {
    // 检查缓存是否有效
    if (accessTokenCache.token && Date.now() < accessTokenCache.expiresAt) {
        return accessTokenCache.token;
    }

    console.log('[WECHAT] Fetching new access_token...');

    try {
        const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${WX_APPID}&secret=${WX_SECRET}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.errcode) {
            console.error('[WECHAT] Failed to get access_token:', data);
            return null;
        }

        // 缓存 token，提前 5 分钟过期
        accessTokenCache = {
            token: data.access_token,
            expiresAt: Date.now() + (data.expires_in - 300) * 1000
        };

        console.log('[WECHAT] access_token obtained, expires in', data.expires_in, 'seconds');
        return accessTokenCache.token;
    } catch (err) {
        console.error('[WECHAT] Error fetching access_token:', err);
        return null;
    }
}

/**
 * 截断字符串（微信消息字段有长度限制）
 * thing: 20字符
 * phrase: 5字符
 * date: 正常日期格式
 */
function truncateString(str, maxLen) {
    if (!str) return '';
    str = String(str);
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen - 1) + '…';
}

/**
 * 格式化日期为微信接受的格式
 */
function formatDateTime(date) {
    const d = date || new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}年${month}月${day}日 ${hours}:${minutes}`;
}

/**
 * 发送微信订阅消息
 * 
 * 模板字段（报名动态通知）：
 * - thing14: 活动名称 (20字符)
 * - date2: 活动时间
 * - thing5: 活动地址 (20字符)
 * - thing12: 姓名 (20字符)
 * - thing4: 最新进展 (20字符)
 * 
 * @param {string} openid - 用户的 openid
 * @param {object} messageData - 消息数据
 * @param {string} messageData.title - 活动名称
 * @param {string} messageData.time - 活动时间
 * @param {string} messageData.location - 活动地址
 * @param {string} messageData.name - 姓名（本人昵称或"代报姓名（XX代报名）"）
 * @param {string} messageData.progress - 最新进展
 * @param {string} page - 跳转页面路径
 */
export async function sendSubscribeMessage(openid, messageData, page = 'pages/home/home') {
    if (!openid) {
        console.log('[WECHAT] No openid provided, skip sending');
        return { errcode: -1, errmsg: 'No openid' };
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
        return { errcode: -1, errmsg: 'Failed to get access_token' };
    }

    const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`;

    // 格式化活动时间 - 确保转换为微信接受的中文日期格式
    let formattedTime;
    if (messageData.time) {
        try {
            // 尝试解析时间字符串
            const dateObj = new Date(messageData.time);
            if (!isNaN(dateObj.getTime())) {
                formattedTime = formatDateTime(dateObj);
            } else {
                formattedTime = formatDateTime(new Date());
            }
        } catch (e) {
            formattedTime = formatDateTime(new Date());
        }
    } else {
        formattedTime = formatDateTime(new Date());
    }

    // 构建消息体
    const body = {
        touser: openid,
        template_id: WX_SUBSCRIBE_TEMPLATE_ID,
        page: page,
        miniprogram_state: process.env.NODE_ENV === 'production' ? 'formal' : 'trial',
        lang: 'zh_CN',
        data: {
            thing14: { value: truncateString(messageData.title || '系统通知', 20) },
            date2: { value: formattedTime },
            thing5: { value: truncateString(messageData.location || '有熊来集', 20) },
            thing12: { value: truncateString(messageData.name || '会员', 20) },
            thing4: { value: truncateString(messageData.progress || '请查看详情', 20) }
        }
    };

    console.log('[WECHAT] Sending subscribe message:', JSON.stringify(body));

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const result = await res.json();

        console.log('[WECHAT] Send result:', result);
        return result;
    } catch (err) {
        console.error('[WECHAT] Error sending message:', err);
        return { errcode: -1, errmsg: err.message };
    }
}

/**
 * 发送简单文本通知
 * 适用于系统通知等场景
 * 
 * @param {string} openid - 用户的 openid
 * @param {string} content - 通知内容
 * @param {string} activityTitle - 活动标题（可选）
 */
export async function sendSimpleNotification(openid, content, activityTitle = null) {
    // 从内容中提取关键信息
    let status = '通知';
    if (content.includes('报名')) status = '报名';
    if (content.includes('候补')) status = '候补';
    if (content.includes('成功')) status = '成功';
    if (content.includes('取消')) status = '取消';

    return sendSubscribeMessage(openid, {
        title: activityTitle || '有熊来集',
        time: formatDateTime(new Date()),
        location: '有熊来集',
        status: status,
        remark: truncateString(content, 20)
    });
}

export { WX_APPID, WX_SECRET, WX_SUBSCRIBE_TEMPLATE_ID };
