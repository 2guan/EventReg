/**
 * 我的积分页面
 * 与网页版 MyScores.tsx 功能完全一致
 */

const app = getApp();
const { api } = require('../../utils/api.js');

Page({
    data: {
        theme: 'light',
        userInfo: {},
        totalPoints: 0,
        currentRank: 0,
        recentRecords: [],
        scoreHistory: [],

        // 编辑资料
        showEditModal: false,
        editNickname: '',
        editPassword: '',
        editAvatar: '',
        showAvatarSelection: false,
        avatars: []
    },

    onLoad() {
        this.initPage();
    },

    onShow() {
        // 未登录时跳转到登录页面
        if (!app.globalData.isAuthenticated) {
            wx.redirectTo({
                url: '/pages/login/login'
            });
            return;
        }

        this.setData({
            theme: app.globalData.theme,
            userInfo: app.globalData.userInfo || {}
        });
        app.updateNavigationBarColor(app.globalData.theme);
        this.fetchMyPoints();

        // 刷新用户信息（积分等）
        this.refreshUserInfo();

        // 更新tab bar选中状态
        if (typeof this.getTabBar === 'function' && this.getTabBar()) {
            this.getTabBar().updateSelected(2);
            this.getTabBar().updateTheme(app.globalData.theme);
        }
    },

    // 刷新用户信息
    async refreshUserInfo() {
        try {
            const userData = await api.auth.me();
            if (userData) {
                // 处理头像URL
                let avatarUrl = userData.avatar;
                if (avatarUrl && avatarUrl.startsWith('/sportsreg')) {
                    avatarUrl = app.globalData.staticUrl + avatarUrl.replace('/sportsreg', '');
                } else if (!avatarUrl) {
                    avatarUrl = app.globalData.defaultAvatar;
                }
                userData.avatar = avatarUrl;

                app.globalData.userInfo = userData;
                this.setData({
                    userInfo: userData,
                    totalPoints: userData.total_points || 0
                });
            }
        } catch (err) {
            console.error('刷新用户信息失败:', err);
        }
    },

    onPullDownRefresh() {
        this.fetchMyPoints().then(() => {
            wx.stopPullDownRefresh();
        });
    },

    initPage() {
        const staticUrl = app.globalData.staticUrl;

        // 生成头像列表
        const avatars = [];
        for (let i = 1; i <= 30; i++) {
            avatars.push(`${staticUrl}/face/defaultface-user%20(${i}).jpg`);
        }

        this.setData({
            theme: app.globalData.theme,
            userInfo: app.globalData.userInfo || {},
            avatars,
            totalPoints: app.globalData.userInfo?.points || 0
        });

        this.fetchMyPoints();
    },

    toggleTheme() {
        const newTheme = app.toggleTheme();
        this.setData({ theme: newTheme });

        // 更新tab bar主题
        if (typeof this.getTabBar === 'function' && this.getTabBar()) {
            this.getTabBar().updateTheme(newTheme);
        }
    },

    goBack() {
        wx.navigateBack({ delta: 1 });
    },

    goToRankings() {
        wx.navigateTo({ url: '/pages/rankings/rankings' });
    },

    async fetchMyPoints() {
        const CACHE_KEY = 'my_scores_data_cache';
        const userId = app.globalData.userInfo?.id;

        // 1. 先尝试从缓存读取数据，实现秒开
        try {
            const cachedData = wx.getStorageSync(CACHE_KEY);
            if (cachedData && cachedData.timestamp && cachedData.userId === userId) {
                // 缓存有效期：5分钟
                const isExpired = Date.now() - cachedData.timestamp > 5 * 60 * 1000;

                if (!isExpired) {
                    // 立即显示缓存数据（不显示loading）
                    this.setData({
                        recentRecords: cachedData.recentRecords || [],
                        totalPoints: cachedData.totalPoints || 0,
                        currentRank: cachedData.currentRank || 0,
                        scoreHistory: cachedData.scoreHistory || []
                    });
                }
            }
        } catch (e) {
            console.warn('读取缓存失败:', e);
        }

        // 2. 后台获取最新数据
        try {
            const userInfo = app.globalData.userInfo;
            if (!userInfo) {
                return;
            }

            // 获取积分历史
            const historyRes = await api.points.myHistory();

            const records = historyRes.map(item => {
                let status = 'participation';
                const reason = item.reason || '';
                const val = item.amount !== undefined ? item.amount : item.points;

                if (reason.includes('活动得分')) {
                    status = 'participation';
                } else if (val > 0) {
                    status = 'win';
                } else if (val < 0) {
                    status = 'lose';
                }

                // 格式化日期 - 转换为北京时间 (UTC+8)
                // SQLite CURRENT_TIMESTAMP 返回UTC时间但没有'Z'后缀，需要手动指定为UTC
                let formattedDate = '';
                try {
                    let dateStr = item.created_at;
                    // 确保作为UTC解析：将空格替换为T，并添加Z后缀
                    if (dateStr && !dateStr.endsWith('Z')) {
                        dateStr = dateStr.replace(' ', 'T') + 'Z';
                    }
                    const d = new Date(dateStr);
                    // UTC时间 + 8小时 = 北京时间
                    const beijingTime = new Date(d.getTime() + (8 * 60 * 60 * 1000));
                    formattedDate = `${beijingTime.getUTCMonth() + 1}月${beijingTime.getUTCDate()}日 ${String(beijingTime.getUTCHours()).padStart(2, '0')}:${String(beijingTime.getUTCMinutes()).padStart(2, '0')}`;
                } catch (e) {
                    formattedDate = item.created_at;
                }

                const statusTextMap = {
                    win: '获得',
                    lose: '扣除',
                    participation: '活动得分'
                };

                return {
                    id: String(item.id),
                    tournamentName: item.match_title || reason || '积分变动',
                    points: item.amount || item.points || 0,
                    date: item.created_at,
                    formattedDate,
                    status,
                    statusText: statusTextMap[status]
                };
            });

            // 计算总积分
            const totalPoints = userInfo.points !== undefined ? userInfo.points :
                records.reduce((sum, r) => sum + r.points, 0);

            // 获取我的排名
            let currentRank = 0;
            try {
                const leaderboardRes = await api.points.leaderboard();
                const myRankIdx = leaderboardRes.findIndex(u => u.id === userInfo.id);
                currentRank = myRankIdx !== -1 ? myRankIdx + 1 : 0;
            } catch (e) {
                console.error('获取排名失败:', e);
            }

            // 生成图表数据（按月聚合）
            const monthsData = Array(12).fill(0).map((_, i) => ({
                name: `${i + 1}月`,
                points: 0,
                height: 8 // 最小高度
            }));

            records.forEach(r => {
                try {
                    // iOS 兼容：将 "yyyy-MM-dd HH:mm:ss" 格式转换为 "yyyy-MM-ddTHH:mm:ss" 格式
                    let dateStr = r.date;
                    if (dateStr && dateStr.includes(' ')) {
                        dateStr = dateStr.replace(' ', 'T');
                    }
                    const d = new Date(dateStr);
                    if (!isNaN(d.getTime())) {
                        const m = d.getMonth();
                        monthsData[m].points += r.points;
                    }
                } catch (e) { }
            });

            // 计算柱状图高度
            const maxPoints = Math.max(...monthsData.map(m => m.points), 1);
            monthsData.forEach(m => {
                m.height = Math.max(8, Math.round((m.points / maxPoints) * 300));
            });

            // 3. 一次性更新所有数据
            this.setData({
                recentRecords: records,
                totalPoints,
                currentRank,
                scoreHistory: monthsData,
                userInfo
            });

            // 4. 保存到缓存
            try {
                wx.setStorageSync(CACHE_KEY, {
                    timestamp: Date.now(),
                    userId,
                    recentRecords: records,
                    totalPoints,
                    currentRank,
                    scoreHistory: monthsData
                });
            } catch (e) {
                console.warn('保存缓存失败:', e);
            }
        } catch (err) {
            console.error('获取积分记录失败:', err);
            wx.showToast({ title: '获取积分记录失败', icon: 'none' });
        }
    },

    // 编辑资料
    openEditProfile() {
        const { userInfo, avatars } = this.data;
        this.setData({
            showEditModal: true,
            editNickname: userInfo.nickname || '',
            editAvatar: userInfo.avatar || avatars[0],
            editPassword: '',
            showAvatarSelection: false
        });
    },

    closeEditModal() {
        this.setData({ showEditModal: false });
    },

    stopPropagation() { },

    toggleAvatarSelection() {
        this.setData({ showAvatarSelection: !this.data.showAvatarSelection });
    },

    selectAvatar(e) {
        const avatar = e.currentTarget.dataset.avatar;
        this.setData({
            editAvatar: avatar,
            showAvatarSelection: false
        });
    },

    // 选择微信头像
    async onChooseWxAvatar(e) {
        const avatarUrl = e.detail.avatarUrl;
        if (!avatarUrl) return;

        try {
            wx.showLoading({ title: '上传头像中...' });

            // 检查是否是临时头像URL，如果是需要上传到服务器
            let finalAvatarUrl = avatarUrl;

            if (avatarUrl.startsWith('http://tmp') || avatarUrl.startsWith('wxfile://')) {
                const uploadRes = await new Promise((resolve, reject) => {
                    wx.uploadFile({
                        url: app.globalData.baseUrl + '/auth/upload-avatar',
                        filePath: avatarUrl,
                        name: 'avatar',
                        success: (res) => {
                            if (res.statusCode === 200) {
                                try {
                                    const data = JSON.parse(res.data);
                                    resolve(data);
                                } catch (e) {
                                    reject(new Error('解析上传结果失败'));
                                }
                            } else {
                                reject(new Error('上传失败: ' + res.statusCode));
                            }
                        },
                        fail: reject
                    });
                });

                if (uploadRes.avatarUrl) {
                    // 将服务器返回的相对路径转换为完整URL用于显示
                    finalAvatarUrl = uploadRes.avatarUrl;
                    if (finalAvatarUrl.startsWith('/sportsreg')) {
                        finalAvatarUrl = app.globalData.staticUrl + finalAvatarUrl.replace('/sportsreg', '');
                    }
                }
            }

            wx.hideLoading();
            wx.showToast({ title: '头像已更新', icon: 'success' });

            this.setData({
                editAvatar: finalAvatarUrl,
                showAvatarSelection: false
            });
        } catch (err) {
            wx.hideLoading();
            console.error('上传头像失败:', err);
            wx.showToast({ title: err.message || '上传头像失败', icon: 'none' });
        }
    },

    onNicknameInput(e) {
        this.setData({ editNickname: e.detail.value });
    },

    onPasswordInput(e) {
        this.setData({ editPassword: e.detail.value });
    },

    // 退出登录
    handleLogout() {
        wx.showModal({
            title: '确认退出',
            content: '确定要退出登录吗？',
            success: (res) => {
                if (res.confirm) {
                    app.logout();
                    wx.showToast({
                        title: '已退出登录',
                        icon: 'success'
                    });
                    // 跳转到首页
                    wx.switchTab({ url: '/pages/home/home' });
                }
            }
        });
    },

    async handleUpdateProfile() {
        const { editNickname, editAvatar, editPassword } = this.data;

        if (!editNickname.trim()) {
            wx.showToast({ title: '请输入昵称', icon: 'none' });
            return;
        }

        try {
            wx.showLoading({ title: '保存中...' });

            await api.auth.update({
                nickname: editNickname,
                avatar: editAvatar,
                password: editPassword || undefined
            });

            // 更新本地用户信息
            const userInfo = {
                ...app.globalData.userInfo,
                nickname: editNickname,
                avatar: editAvatar
            };
            app.globalData.userInfo = userInfo;
            wx.setStorageSync('userInfo', userInfo);

            wx.hideLoading();
            wx.showToast({ title: '保存成功', icon: 'success' });

            this.setData({
                showEditModal: false,
                userInfo
            });
        } catch (err) {
            wx.hideLoading();
            wx.showToast({ title: err.message || '保存失败', icon: 'none' });
        }
    }
});
