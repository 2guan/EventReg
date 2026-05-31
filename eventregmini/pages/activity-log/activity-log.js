/**
 * 活动日志页面
 * 记录每个活动的所有报名记录
 */

const app = getApp();
const { api } = require('../../utils/api.js');

Page({
    data: {
        theme: 'light',
        userInfo: null,
        logs: [],
        matches: [],
        matchOptions: [], // 筛选下拉菜单选项
        selectedMatchTitle: '', // 已选中的活动名称
        loading: true,
        showFilters: false,

        // 管理员提醒相关状态
        showReminderDialog: false,
        reminderStatus: {
            join: 0,
            cancel: 0
        },

        // 筛选条件
        filterMatchId: '',
        filterOperation: '',
        filterKeyword: ''
    },


    onLoad() {
        this.setData({
            theme: app.globalData.theme,
            userInfo: app.globalData.userInfo
        });
    },

    onShow() {
        this.setData({
            theme: app.globalData.theme,
            userInfo: app.globalData.userInfo
        });
        app.updateNavigationBarColor(app.globalData.theme);
        this.fetchData();

        // 如果是管理员，获取提醒状态
        if (app.globalData.userInfo && app.globalData.userInfo.role === 'admin') {
            this.fetchReminderStatus();
        }
    },


    // 返回上一页
    goBack() {
        wx.navigateBack({ delta: 1 });
    },

    // 切换主题
    toggleTheme() {
        const newTheme = app.toggleTheme();
        this.setData({ theme: newTheme });
    },

    // 切换筛选面板
    toggleFilters() {
        this.setData({ showFilters: !this.data.showFilters });
    },

    // 获取数据
    async fetchData() {
        this.setData({ loading: true });
        try {
            const [logsRes, matchesRes] = await Promise.all([
                api.get('/logs/enrollments'),
                api.get('/logs/matches')
            ]);

            // 格式化日志数据
            const logs = logsRes.map(log => ({
                ...log,
                formattedRecordTime: this.formatDateTime(log.recordTime),
                formattedEnrollTime: this.formatDateTime(log.enrollTime),
                formattedMatchTime: this.formatMatchTime(log.matchTime, log.matchDuration),
                operationText: log.operation === 'join' ? '报名' : '取消报名'
            }));

            // 生成筛选下拉选项（第一个是"全部活动"）
            const matchOptions = [{ id: '', title: '全部活动' }, ...matchesRes];

            this.setData({
                logs,
                matches: matchesRes,
                matchOptions,
                loading: false
            });
        } catch (err) {
            console.error('加载日志失败:', err);
            wx.showToast({ title: '加载失败', icon: 'none' });
            this.setData({ loading: false });
        }
    },

    // 格式化日期: 2025.12.1 17:09 (直接解析字符串，不做时区转换)
    formatDateTime(dateStr) {
        if (!dateStr) return '-';
        // 期望格式: "2025-12-14 22:28:33" 或 "2025-12-14T22:28:33"
        const cleanStr = dateStr.replace('T', ' ').substring(0, 19);
        const parts = cleanStr.split(' ');
        if (parts.length < 2) return dateStr;

        const datePart = parts[0];
        const timePart = parts[1];
        const dateParts = datePart.split('-');
        const timeParts = timePart.split(':');

        return `${dateParts[0]}.${parseInt(dateParts[1])}.${parseInt(dateParts[2])} ${timeParts[0]}:${timeParts[1]}`;
    },

    // 格式化活动时间
    formatMatchTime(timeStr, durationMinutes) {
        if (!timeStr) return '-';
        const start = new Date(timeStr);
        const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

        const startMonth = start.getMonth() + 1;
        const startDay = start.getDate();
        const startHours = String(start.getHours()).padStart(2, '0');
        const startMinutes = String(start.getMinutes()).padStart(2, '0');

        const endMonth = end.getMonth() + 1;
        const endDay = end.getDate();
        const endHours = String(end.getHours()).padStart(2, '0');
        const endMinutes = String(end.getMinutes()).padStart(2, '0');

        // 判断是否跨天
        if (start.toDateString() === end.toDateString()) {
            return `${startMonth}月${startDay}日 ${startHours}:${startMinutes}-${endHours}:${endMinutes}`;
        } else {
            return `${startMonth}月${startDay}日 ${startHours}:${startMinutes}-${endMonth}月${endDay}日 ${endHours}:${endMinutes}`;
        }
    },

    // 筛选活动变化
    onFilterMatchChange(e) {
        const index = parseInt(e.detail.value);
        const selected = this.data.matchOptions[index] || {};
        this.setData({
            filterMatchId: selected.id || '',
            selectedMatchTitle: selected.id ? selected.title : ''
        });
    },

    // 筛选操作类型变化
    onFilterOperationChange(e) {
        const operations = ['', 'join', 'cancel'];
        this.setData({ filterOperation: operations[e.detail.value] });
    },

    // 关键词输入
    onKeywordInput(e) {
        this.setData({ filterKeyword: e.detail.value });
    },

    // 执行筛选
    async handleFilter() {
        this.setData({ loading: true });
        try {
            let url = '/logs/enrollments?';
            if (this.data.filterMatchId) url += `match_id=${this.data.filterMatchId}&`;
            if (this.data.filterOperation) url += `operation=${this.data.filterOperation}&`;

            const logsRes = await api.get(url);
            const logs = logsRes.map(log => ({
                ...log,
                formattedRecordTime: this.formatDateTime(log.recordTime),
                formattedEnrollTime: this.formatDateTime(log.enrollTime),
                formattedMatchTime: this.formatMatchTime(log.matchTime, log.matchDuration),
                operationText: log.operation === 'join' ? '报名' : '取消报名'
            }));

            this.setData({ logs, loading: false });
        } catch (err) {
            wx.showToast({ title: '筛选失败', icon: 'none' });
            this.setData({ loading: false });
        }
    },

    // 清除筛选
    clearFilters() {
        this.setData({
            filterMatchId: '',
            filterOperation: '',
            filterKeyword: ''
        });
        this.fetchData();
    },

    // 获取过滤后的日志（客户端关键词过滤）
    getFilteredLogs() {
        const { logs, filterKeyword } = this.data;
        if (!filterKeyword) return logs;

        const keyword = filterKeyword.toLowerCase();
        return logs.filter(log =>
            log.username.toLowerCase().includes(keyword) ||
            log.nickname.toLowerCase().includes(keyword) ||
            log.enrolledForName.toLowerCase().includes(keyword) ||
            log.matchTitle.toLowerCase().includes(keyword)
        );
    },

    // 获取管理员提醒状态
    async fetchReminderStatus() {
        try {
            const status = await api.get('/admin-reminders/status');
            this.setData({ reminderStatus: status });
        } catch (err) {
            console.error('获取提醒状态失败:', err);
        }
    },

    // 显示提醒弹窗
    showReminderDialog() {
        this.setData({ showReminderDialog: true });
    },

    // 隐藏提醒弹窗
    hideReminderDialog() {
        this.setData({ showReminderDialog: false });
    },

    // 防止点击弹窗内容时关闭
    preventClose() {
        // 空函数，阻止事件冒泡
    },

    // 订阅管理员提醒
    async subscribeReminder(e) {
        const reminderType = e.currentTarget.dataset.type;
        const typeName = reminderType === 'join' ? '报名提醒' : '退报提醒';
        const tmplId = 'MCFmhtZXaEKfYSxEMDBJDBlqEwL7eOur4N4MEUm9Xt0';

        try {
            // 1. 请求微信订阅消息授权
            await new Promise((resolve, reject) => {
                wx.requestSubscribeMessage({
                    tmplIds: [tmplId],
                    success: (res) => {
                        if (res[tmplId] === 'accept') {
                            resolve();
                        } else {
                            reject(new Error('用户拒绝授权'));
                        }
                    },
                    fail: (err) => {
                        console.error('Request subscribe failed:', err);
                        reject(err);
                    }
                });
            });

            // 2. 后端记录
            wx.showLoading({ title: '订阅中...' });
            const res = await api.post('/admin-reminders/subscribe', { reminderType });
            wx.hideLoading();

            if (res.success) {
                wx.showToast({
                    title: `${typeName}订阅成功`,
                    icon: 'success'
                });

                // 更新状态
                this.setData({
                    [`reminderStatus.${reminderType}`]: res.count
                });
            }
        } catch (err) {
            wx.hideLoading();
            if (err.message === '用户拒绝授权') {
                wx.showToast({ title: '您取消了授权', icon: 'none' });
            } else {
                wx.showToast({
                    title: '订阅失败',
                    icon: 'none'
                });
                console.error('订阅失败:', err);
            }
        }
    },

    // 清空所有日志
    async handleClearLogs() {
        const confirmed = await new Promise((resolve) => {
            wx.showModal({
                title: '确认清空',
                content: '确定要清空所有日志吗？此操作不可恢复。',
                confirmColor: '#ef4444',
                success: (res) => resolve(res.confirm)
            });
        });
        if (!confirmed) return;

        try {
            await api.delete('/logs/enrollments');
            wx.showToast({ title: '日志已清空', icon: 'success' });
            this.setData({ logs: [] });
        } catch (err) {
            wx.showToast({ title: '清空失败', icon: 'none' });
        }
    }
});
