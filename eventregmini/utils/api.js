/**
 * API 请求封装
 * 统一管理所有后端接口调用
 */

const app = getApp();

const BASE_URL = 'https://sportsreg.shenhaimujing.com/sportsreg/api';

/**
 * 发起HTTP请求
 * @param {string} url - 请求路径
 * @param {string} method - 请求方法
 * @param {object} data - 请求数据
 * @returns {Promise}
 */
function request(url, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const fullUrl = url.startsWith('http') ? url : BASE_URL + url;
        const token = wx.getStorageSync('token');

        const requestConfig = {
            url: fullUrl,
            method: method,
            header: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            success: function (res) {
                if (res.statusCode === 200) {
                    resolve(res.data);
                } else if (res.statusCode === 401) {
                    // Token过期
                    if (app) {
                        app.logout();
                    }
                    wx.removeStorageSync('token');
                    wx.removeStorageSync('userInfo');
                    reject({ error: '登录已过期，请重新登录', statusCode: 401 });
                } else {
                    reject(res.data || { error: '请求失败' });
                }
            },
            fail: function (err) {
                console.error('请求失败:', err);
                reject({ error: '网络请求失败，请检查网络连接' });
            }
        };

        // 只有非DELETE请求且data不为空时才传data
        if (data !== null && method !== 'DELETE') {
            requestConfig.data = data;
        }

        wx.request(requestConfig);
    });
}

/**
 * API对象 - 包含所有接口方法
 */
const api = {
    // GET请求
    get: function (url) {
        return request(url, 'GET');
    },

    // POST请求
    post: function (url, data) {
        return request(url, 'POST', data);
    },

    // PUT请求
    put: function (url, data) {
        return request(url, 'PUT', data);
    },

    // DELETE请求
    delete: function (url) {
        return request(url, 'DELETE');
    },

    // PATCH请求
    patch: function (url, data) {
        return request(url, 'PATCH', data);
    },

    // ==================== 认证相关 ====================
    auth: {
        // 登录
        login: function (username, password) {
            return request('/auth/login', 'POST', { username, password });
        },

        // 注册
        register: function (data) {
            return request('/auth/register', 'POST', data);
        },

        // 微信登录
        wxLogin: function (code, nickname, avatar) {
            return request('/auth/wx-login', 'POST', { code, nickname, avatar });
        },

        // 获取当前用户信息
        me: function () {
            return request('/auth/me', 'GET');
        },

        // 更新用户信息
        updateProfile: function (data) {
            return request('/auth/profile', 'PUT', data);
        },

        // 更新个人资料(编辑资料页面用)
        update: function (data) {
            return request('/auth/update', 'PUT', data);
        },

        // 微信注册
        wxRegister: function (data) {
            return request('/auth/wx-register', 'POST', data);
        },

        // 同步微信头像
        syncAvatar: function (avatar) {
            return request('/auth/sync-avatar', 'PUT', { avatar });
        }
    },

    // ==================== 活动相关 ====================
    matches: {
        // 获取所有活动
        list: function (source) {
            const url = source ? `/matches?source=${source}` : '/matches';
            return request(url, 'GET');
        },

        // 获取单个活动详情
        get: function (id) {
            return request(`/matches/${id}`, 'GET');
        },

        // 创建活动
        create: function (data) {
            return request('/matches', 'POST', data);
        },

        // 更新活动
        update: function (id, data) {
            return request(`/matches/${id}`, 'PUT', data);
        },

        // 删除活动
        delete: function (id) {
            return request(`/matches/${id}`, 'DELETE');
        },

        // 切换锁定状态
        toggleLock: function (id, lockState) {
            return request(`/matches/${id}/lock`, 'PATCH', { lockState });
        },

        // 发送开始提醒
        sendStartReminder: function (id) {
            return request(`/matches/${id}/start-reminder`, 'POST');
        }
    },

    // ==================== 报名相关 ====================
    enrollments: {
        // 获取某活动的所有报名
        list: function (matchId) {
            return request(`/enrollments/${matchId}`, 'GET');
        },

        // 获取我的报名列表
        myList: function () {
            return request('/enrollments/my/list', 'GET');
        },

        // 报名
        join: function (data) {
            return request('/enrollments/join', 'POST', data);
        },

        // 取消报名
        cancel: function (enrollmentId) {
            return request('/enrollments/cancel', 'POST', { enrollment_id: enrollmentId });
        },

        // 批量更新积分
        updateScores: function (scores) {
            return request('/enrollments/scores', 'POST', { scores });
        }
    },

    // ==================== 用户管理相关 ====================
    users: {
        // 获取所有用户
        list: function () {
            return request('/users', 'GET');
        },

        // 更新用户信息（管理员）
        update: function (userId, data) {
            return request(`/users/${userId}`, 'PUT', data);
        },

        // 审核用户
        approve: function (userId) {
            return request(`/users/${userId}/approve`, 'PUT');
        },

        // 拒绝用户
        reject: function (userId) {
            return request(`/users/${userId}/reject`, 'DELETE');
        },

        // 删除用户
        delete: function (userId) {
            return request(`/users/${userId}`, 'DELETE');
        },

        // 更新用户积分
        updatePoints: function (userId, adjustment, reason) {
            return request(`/users/${userId}/points`, 'PUT', { adjustment, reason });
        }
    },

    // ==================== 排行榜相关 ====================
    rankings: {
        // 获取排行榜
        get: function () {
            return request('/rankings', 'GET');
        }
    },

    // ==================== 积分相关 ====================
    points: {
        // 获取我的积分记录
        myRecords: function () {
            return request('/points/my', 'GET');
        },

        // 获取我的积分历史
        myHistory: function () {
            return request('/points/my/history', 'GET');
        },

        // 获取排行榜
        leaderboard: function () {
            return request('/points/leaderboard', 'GET');
        }
    },

    // ==================== 通知相关 ====================
    notifications: {
        // 获取我的通知
        list: function () {
            return request('/notifications', 'GET');
        },

        // 删除通知
        delete: function (notificationId) {
            return request(`/notifications/${notificationId}`, 'DELETE');
        },

        // 标记单条已读
        markAsRead: function (notificationId) {
            return request(`/notifications/${notificationId}/read`, 'POST');
        },

        // 全部已读
        markAllRead: function () {
            return request('/notifications/read-all', 'POST');
        },

        // 全部删除
        deleteAll: function () {
            return request('/notifications/delete-all', 'DELETE');
        },

        // 保存订阅授权（支持累积次数）
        subscribe: function (templateId, count = 1) {
            return request('/notifications/subscribe', 'POST', { template_id: templateId, count: count });
        },

        // 检查订阅状态
        subscribeStatus: function (templateId) {
            return request(`/notifications/subscribe/status?template_id=${templateId}`, 'GET');
        }
    },

    // ==================== 系统设置相关 ====================
    settings: {
        // 获取系统设置
        get: function () {
            return request('/settings', 'GET');
        },

        // 更新通知设置
        updateNotification: function (enabled) {
            return request('/notifications/settings', 'POST', { enabled });
        },

        // 获取注册设置
        getRegistration: function () {
            return request('/settings/registration', 'GET');
        },

        // 更新注册设置
        updateRegistration: function (data) {
            return request('/settings/registration', 'PUT', data);
        },

        // 获取微信推送设置
        getWxPush: function () {
            return request('/notifications/wx-push', 'GET');
        },

        // 更新微信推送设置
        updateWxPush: function (enabled) {
            return request('/notifications/wx-push', 'POST', { enabled });
        }
    }
};

module.exports = {
    api,
    request,
    BASE_URL
};
