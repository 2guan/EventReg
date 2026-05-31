/**
 * 我的报名页面
 * 与网页版 MyTournaments.tsx 完全一致
 */

const app = getApp();
const { api } = require('../../utils/api.js');
const mappers = require('../../utils/mappers.js');

Page({
    data: {
        theme: 'light',
        isAuthenticated: false,
        tournaments: [],
        loading: true
    },

    onLoad() {
        this.initPage();
    },

    onShow() {
        this.initPage();
        app.updateNavigationBarColor(app.globalData.theme);
        if (app.globalData.isAuthenticated) {
            this.fetchMyTournaments();
        }
    },

    initPage() {
        this.setData({
            theme: app.globalData.theme,
            isAuthenticated: app.globalData.isAuthenticated
        });
    },

    toggleTheme() {
        const newTheme = app.toggleTheme();
        this.setData({ theme: newTheme });
    },

    goBack() {
        wx.navigateBack({ delta: 1 });
    },

    async fetchMyTournaments() {
        this.setData({ loading: true });

        try {
            const enrollmentsRes = await api.enrollments.myList();

            // 按活动分组
            const groupedEnrollments = {};
            enrollmentsRes.forEach(e => {
                const mId = String(e.match_id);
                if (!groupedEnrollments[mId]) {
                    groupedEnrollments[mId] = [];
                }
                groupedEnrollments[mId].push(e);
            });

            // 映射活动数据
            const tournaments = Object.values(groupedEnrollments).map(group => {
                const e = group[0];

                const backendMatch = {
                    id: e.match_id,
                    title: e.title,
                    description: e.description || '',
                    time: e.match_time || e.time,
                    location: e.location,
                    max_players: e.max_players,
                    max_waitlist: e.max_waitlist,
                    duration: e.duration || 90,
                    status: e.match_status,
                    config_json: e.config_json,
                    registered_count: e.registered_count,
                    waitlist_count: e.waitlist_count
                };

                const frontendMatch = mappers.mapBackendToFrontend(backendMatch, group.length);

                // 计算状态标签
                const selfEnrollment = group.find(item => !item.enrolled_for_name);
                const proxyEnrollments = group.filter(item => item.enrolled_for_name);
                const proxyCount = proxyEnrollments.length;

                let customStatusLabel = '已报名';
                if (selfEnrollment && proxyCount > 0) {
                    customStatusLabel = `已报名 代报名${proxyCount}人`;
                } else if (!selfEnrollment && proxyCount > 0) {
                    customStatusLabel = `代报名${proxyCount}人`;
                }

                return {
                    ...frontendMatch,
                    isSelfEnrolled: !!selfEnrollment,
                    proxyCount: proxyCount,
                    customStatusLabel, // Keep for backward compatibility if needed
                    statusText: mappers.getStatusText(frontendMatch.status),
                    statusClass: mappers.getStatusClass(frontendMatch.status)
                };
            });

            this.setData({
                tournaments,
                loading: false
            });
        } catch (err) {
            console.error('获取报名失败:', err);
            wx.showToast({ title: '加载失败', icon: 'none' });
            this.setData({ loading: false });
        }
    },

    goToTournament(e) {
        const id = e.currentTarget.dataset.id;
        wx.navigateTo({ url: `/pages/tournament-detail/tournament-detail?id=${id}` });
    },

    goToLogin() {
        wx.navigateTo({ url: '/pages/login/login' });
    },

    onPullDownRefresh() {
        if (app.globalData.isAuthenticated) {
            this.fetchMyTournaments().then(() => wx.stopPullDownRefresh());
        } else {
            wx.stopPullDownRefresh();
        }
    },

    // 分享活动给好友
    onShareAppMessage(options) {
        const tournament = options.target?.dataset?.tournament;
        const shareImage = options.target?.dataset?.shareImage;

        if (tournament && tournament.id) {
            return {
                title: tournament.name || '有熊来集',
                path: `/pages/tournament-detail/tournament-detail?id=${tournament.id}`,
                imageUrl: shareImage || tournament.image || ''
            };
        }

        return {
            title: '有熊来集 - 我的报名',
            path: '/pages/my-tournaments/my-tournaments'
        };
    }
});
