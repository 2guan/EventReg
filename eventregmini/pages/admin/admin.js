/**
 * 管理中心页面
 * 与网页版 Admin.tsx 完全一致
 */

const app = getApp();
const { api } = require('../../utils/api.js');
const mappers = require('../../utils/mappers.js');

Page({
    data: {
        theme: 'light',
        isAuthenticated: false,
        userInfo: null,
        activeTab: 'tournaments',
        tournaments: [],
        users: [],
        pendingUsers: [],
        notificationEnabled: true,
        wxPushEnabled: false,
        statusFilter: 'all',
        statusFilterLabel: '状态筛选',
        statusOptions: [
            { value: 'all', label: '状态筛选' },
            { value: 'pre-registration', label: '预报名' },
            { value: 'registration', label: '正式报名' },
            { value: 'finished-pending', label: '待结算' },
            { value: 'finished-completed', label: '已结束' },
            { value: 'cancelled', label: '已取消' }
        ],
        loading: true,

        tabs: [
            { key: 'tournaments', label: '活动管理' },
            { key: 'users', label: '用户管理' },
            { key: 'settings', label: '系统设置' }
        ]
    },

    onLoad() {
        this.initPage();
    },

    onShow() {
        this.initPage();
        app.updateNavigationBarColor(app.globalData.theme);
        this.fetchData();
    },

    // 初始化页面
    initPage() {
        this.setData({
            theme: app.globalData.theme,
            isAuthenticated: app.globalData.isAuthenticated,
            userInfo: app.globalData.userInfo
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

    // 返回首页
    goToHome() {
        wx.switchTab({ url: '/pages/home/home' });
    },

    // 登出
    handleLogout() {
        app.logout();
        wx.reLaunch({ url: '/pages/login/login' });
    },

    // 阻止事件冒泡
    stopPropagation() {
        // 空函数
    },

    // 获取数据
    async fetchData() {
        this.setData({ loading: true });

        try {
            if (this.data.activeTab === 'tournaments') {
                const res = await api.matches.list('admin');
                const tournaments = res.map(m => {
                    const mapped = mappers.mapBackendToFrontend(m);
                    // 格式化日期时间
                    let formattedDateTime = '';
                    try {
                        // 解析日期时间（不添加Z后缀，避免时区转换）
                        const startStr = mapped.startDateTime || '';
                        const endStr = mapped.endDateTime || '';

                        // 解析开始时间
                        const startParts = startStr.replace('T', ' ').split(' ');
                        const startDateParts = (startParts[0] || '').split('-');
                        const startTimeParts = (startParts[1] || '00:00').split(':');
                        const startMonth = parseInt(startDateParts[1]) || 1;
                        const startDay = parseInt(startDateParts[2]) || 1;
                        const startHour = startTimeParts[0] || '00';
                        const startMinute = startTimeParts[1] || '00';

                        // 解析结束时间
                        const endParts = endStr.replace('T', ' ').split(' ');
                        const endDateParts = (endParts[0] || '').split('-');
                        const endTimeParts = (endParts[1] || '00:00').split(':');
                        const endMonth = parseInt(endDateParts[1]) || 1;
                        const endDay = parseInt(endDateParts[2]) || 1;
                        const endHour = endTimeParts[0] || '00';
                        const endMinute = endTimeParts[1] || '00';

                        // 判断是否同一天
                        const isSameDay = startParts[0] === endParts[0];

                        if (isSameDay) {
                            // 不跨天: 11月9日 9:00-12:00
                            formattedDateTime = `${startMonth}月${startDay}日 ${startHour}:${startMinute}-${endHour}:${endMinute}`;
                        } else {
                            // 跨天: 11月9日 9:00-11月10日 12:00
                            formattedDateTime = `${startMonth}月${startDay}日 ${startHour}:${startMinute}-${endMonth}月${endDay}日 ${endHour}:${endMinute}`;
                        }
                    } catch (e) {
                        formattedDateTime = mapped.date + ' ' + mapped.startTime;
                    }

                    return {
                        ...mapped,
                        formattedDateTime,
                        statusText: mappers.getStatusText(mapped.status),
                        statusClass: mappers.getStatusClass(mapped.status)
                    };
                });

                // 排序：按开始时间降序（最未来到最过去）
                tournaments.sort((a, b) => {
                    const dateA = new Date((a.startDateTime || a.date || '').replace(' ', 'T')).getTime() || 0;
                    const dateB = new Date((b.startDateTime || b.date || '').replace(' ', 'T')).getTime() || 0;
                    return dateB - dateA; // 降序
                });

                this.setData({ tournaments });
            } else if (this.data.activeTab === 'users') {
                const res = await api.users.list();

                const staticUrl = app.globalData.staticUrl;
                const defaultAvatar = staticUrl + '/face/defaultface-user%20(1).jpg';

                const users = (res || []).map(u => {
                    let avatarUrl = u.avatar || defaultAvatar;
                    if (avatarUrl.startsWith('/sportsreg')) {
                        avatarUrl = staticUrl + avatarUrl.replace('/sportsreg', '');
                    }
                    return {
                        ...u,
                        avatar: avatarUrl
                    };
                });

                // 预先筛选待审核用户
                const pendingUsers = users.filter(u => u.status === 'pending');

                this.setData({ users, pendingUsers });
            } else if (this.data.activeTab === 'settings') {
                // 获取微信推送设置
                try {
                    const wxPushRes = await api.settings.getWxPush();
                    this.setData({ wxPushEnabled: wxPushRes.enabled });
                } catch (err) {
                    console.error('获取微信推送设置失败:', err);
                }
            }
        } catch (err) {
            console.error('获取数据失败:', err);
            wx.showToast({
                title: '加载失败',
                icon: 'none'
            });
        } finally {
            this.setData({ loading: false });
        }
    },

    // 切换标签
    onTabChange(e) {
        const tab = e.currentTarget.dataset.tab;
        this.setData({ activeTab: tab });
        this.fetchData();
    },

    // 状态筛选变化
    onStatusFilterChange(e) {
        const index = e.detail.value;
        const option = this.data.statusOptions[index];
        this.setData({
            statusFilter: option.value,
            statusFilterLabel: option.label
        });
    },

    // 跳转到创建活动
    goToCreateTournament() {
        wx.navigateTo({ url: '/pages/create-tournament/create-tournament' });
    },

    // 跳转到编辑活动
    goToEditTournament(e) {
        const id = e.currentTarget.dataset.id;
        wx.navigateTo({ url: `/pages/edit-tournament/edit-tournament?id=${id}` });
    },

    // 删除活动
    async deleteTournament(e) {
        const id = e.currentTarget.dataset.id;
        const name = e.currentTarget.dataset.name;

        const confirmed = await app.showModal('确认删除', `确定要删除"${name}"吗？此操作不可恢复。`);
        if (!confirmed) return;

        try {
            wx.showLoading({ title: '删除中...' });
            await api.matches.delete(id);

            wx.hideLoading();
            wx.showToast({
                title: '删除成功',
                icon: 'success'
            });

            this.fetchData();
        } catch (err) {
            wx.hideLoading();
            wx.showToast({
                title: err.error || '删除失败',
                icon: 'none'
            });
        }
    },

    // 跳转到用户管理
    goToAdminUsers() {
        wx.navigateTo({ url: '/pages/admin-users/admin-users' });
    },

    // 审核用户
    async approveUser(e) {
        const id = e.currentTarget.dataset.id;

        try {
            wx.showLoading({ title: '处理中...' });
            await api.users.approve(id);

            wx.hideLoading();
            wx.showToast({
                title: '审核通过',
                icon: 'success'
            });

            this.fetchData();
        } catch (err) {
            wx.hideLoading();
            wx.showToast({
                title: err.error || '操作失败',
                icon: 'none'
            });
        }
    },

    // 拒绝用户
    async rejectUser(e) {
        const id = e.currentTarget.dataset.id;

        const confirmed = await app.showModal('确认拒绝', '拒绝后该用户将被删除，确定要拒绝吗？');
        if (!confirmed) return;

        try {
            wx.showLoading({ title: '处理中...' });
            await api.users.reject(id);

            wx.hideLoading();
            wx.showToast({
                title: '已拒绝',
                icon: 'success'
            });

            this.fetchData();
        } catch (err) {
            wx.hideLoading();
            wx.showToast({
                title: err.error || '操作失败',
                icon: 'none'
            });
        }
    },

    // 切换通知设置
    async toggleNotification(e) {
        const enabled = e.detail.value;

        try {
            await api.settings.updateNotification(enabled);
            this.setData({ notificationEnabled: enabled });

            wx.showToast({
                title: enabled ? '已开启通知' : '已关闭通知',
                icon: 'success'
            });
        } catch (err) {
            wx.showToast({
                title: '设置失败',
                icon: 'none'
            });
        }
    },

    // 切换微信推送设置
    async toggleWxPush(e) {
        const enabled = e.detail.value;

        try {
            await api.settings.updateWxPush(enabled);
            this.setData({ wxPushEnabled: enabled });

            wx.showToast({
                title: enabled ? '已开启微信推送' : '已关闭微信推送',
                icon: 'success'
            });
        } catch (err) {
            wx.showToast({
                title: '设置失败',
                icon: 'none'
            });
        }
    },

    // 下拉刷新
    onPullDownRefresh() {
        this.fetchData().then(() => {
            wx.stopPullDownRefresh();
        });
    },

    // 跳转到活动日志
    goToActivityLog() {
        wx.navigateTo({ url: '/pages/activity-log/activity-log' });
    },

    // 跳转到活动图片配置
    goToBannerConfig() {
        wx.navigateTo({ url: '/pages/banner-config/banner-config' });
    },

    // 跳转到缓存日志清理
    goToCacheCleanup() {
        wx.navigateTo({ url: '/pages/cache-cleanup/cache-cleanup' });
    }
});
