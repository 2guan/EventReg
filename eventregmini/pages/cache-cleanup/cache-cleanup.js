/**
 * 缓存日志清理页面
 * 管理系统日志、通知记录、临时文件等缓存数据
 */

const app = getApp();
const { api } = require('../../utils/api.js');

// 格式化文件大小
function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

Page({
    data: {
        theme: 'light',
        stats: null,
        loading: true,
        cleaningItem: null,
        cleanupItems: []
    },

    onLoad() {
        this.initPage();
    },

    onShow() {
        app.updateNavigationBarColor(app.globalData.theme);
        this.loadStats();
    },

    initPage() {
        this.setData({
            theme: app.globalData.theme
        });

        // 检查权限
        if (!app.globalData.isAuthenticated || app.globalData.userInfo?.role !== 'admin') {
            wx.showToast({
                title: '无权访问',
                icon: 'none'
            });
            setTimeout(() => {
                wx.navigateBack({ delta: 1 });
            }, 1000);
        }
    },

    // 切换主题
    toggleTheme() {
        const newTheme = app.toggleTheme();
        this.setData({ theme: newTheme });
    },

    // 返回上一页
    goBack() {
        wx.navigateBack({ delta: 1 });
    },

    // 加载统计数据
    async loadStats() {
        this.setData({ loading: true });

        try {
            const stats = await api.get('/cleanup/stats');

            // 构建清理项列表
            const cleanupItems = [
                {
                    key: 'enrollment-logs',
                    name: '报名日志',
                    icon: '📝',
                    iconBg: 'blue',
                    count: stats.enrollmentLogs,
                    description: '记录每次报名/取消操作的日志'
                },
                {
                    key: 'notifications',
                    name: '通知记录',
                    icon: '🔔',
                    iconBg: 'yellow',
                    count: stats.notifications,
                    description: '用户通知历史记录'
                },
                {
                    key: 'wx-subscriptions',
                    name: '微信订阅记录',
                    icon: '💬',
                    iconBg: 'green',
                    count: stats.wxSubscriptions,
                    description: '用户微信订阅授权记录'
                },
                {
                    key: 'uploaded-avatars',
                    name: '未使用的头像',
                    icon: '🖼️',
                    iconBg: 'purple',
                    count: stats.uploadedAvatars.unused,
                    size: stats.uploadedAvatars.totalSize,
                    sizeText: formatSize(stats.uploadedAvatars.totalSize),
                    description: `共 ${stats.uploadedAvatars.total} 个头像，${stats.uploadedAvatars.used} 个正在使用`
                },
                {
                    key: 'temp-files',
                    name: '临时文件',
                    icon: '📁',
                    iconBg: 'orange',
                    count: stats.tempFiles.count,
                    size: stats.tempFiles.size,
                    sizeText: formatSize(stats.tempFiles.size),
                    description: '上传时产生的临时文件'
                },
                {
                    key: 'server-log',
                    name: '服务器日志',
                    icon: '💾',
                    iconBg: 'red',
                    size: stats.serverLog.size,
                    sizeText: formatSize(stats.serverLog.size),
                    description: '服务器运行日志文件'
                }
            ];

            // 标记是否为空
            cleanupItems.forEach(item => {
                item.isEmpty = (item.count === 0 || item.count === undefined) && (!item.size || item.size === 0);
            });

            this.setData({
                stats,
                cleanupItems,
                loading: false
            });
        } catch (err) {
            console.error('加载统计数据失败:', err);
            wx.showToast({
                title: '加载失败',
                icon: 'none'
            });
            this.setData({ loading: false });
        }
    },

    // 清理单项
    async handleCleanup(e) {
        const { key, name } = e.currentTarget.dataset;

        const confirmed = await app.showModal('确认清理', `确定要清理「${name}」吗？此操作不可撤销。`);
        if (!confirmed) return;

        this.setData({ cleaningItem: key });

        try {
            const token = wx.getStorageSync('token');

            const res = await new Promise((resolve, reject) => {
                wx.request({
                    url: app.globalData.baseUrl + '/cleanup/' + key,
                    method: 'DELETE',
                    header: {
                        'Authorization': 'Bearer ' + token
                    },
                    success: (res) => {
                        if (res.statusCode === 200) {
                            resolve(res.data);
                        } else {
                            reject(new Error(res.data?.error || '清理失败'));
                        }
                    },
                    fail: reject
                });
            });

            wx.showToast({
                title: `${name} 清理完成`,
                icon: 'success'
            });

            // 刷新统计
            this.loadStats();
        } catch (err) {
            console.error('清理失败:', err);
            wx.showToast({
                title: err.message || '清理失败',
                icon: 'none'
            });
        } finally {
            this.setData({ cleaningItem: null });
        }
    },

    // 一键清理全部
    async handleCleanupAll() {
        const confirmed = await app.showModal('确认清理', '确定要清理所有缓存和日志吗？此操作不可撤销。\n\n注意：正在使用的头像不会被删除。');
        if (!confirmed) return;

        this.setData({ cleaningItem: 'all' });

        try {
            const token = wx.getStorageSync('token');

            await new Promise((resolve, reject) => {
                wx.request({
                    url: app.globalData.baseUrl + '/cleanup/all',
                    method: 'DELETE',
                    header: {
                        'Authorization': 'Bearer ' + token
                    },
                    success: (res) => {
                        if (res.statusCode === 200) {
                            resolve(res.data);
                        } else {
                            reject(new Error(res.data?.error || '清理失败'));
                        }
                    },
                    fail: reject
                });
            });

            wx.showToast({
                title: '全部清理完成',
                icon: 'success'
            });

            this.loadStats();
        } catch (err) {
            console.error('清理失败:', err);
            wx.showToast({
                title: err.message || '清理失败',
                icon: 'none'
            });
        } finally {
            this.setData({ cleaningItem: null });
        }
    },

    // 下拉刷新
    onPullDownRefresh() {
        this.loadStats().then(() => {
            wx.stopPullDownRefresh();
        });
    }
});
