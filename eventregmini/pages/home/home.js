/**
 * 首页
 * 与网页版 Home.tsx 完全一致
 */

const app = getApp();
const { api } = require('../../utils/api.js');
const mappers = require('../../utils/mappers.js');

Page({
    data: {
        theme: 'light',
        isAuthenticated: false,
        userInfo: null,
        upcomingTournaments: [],
        myRegisteredTournaments: [],
        hasUpcomingRegisteredTournaments: false,
        loading: true
    },

    onLoad() {
        this.initPage();
    },

    onShow() {
        this.initPage();
        // 刷新数据
        this.fetchData();

        // 刷新用户信息（积分等）
        this.refreshUserInfo();

        // 更新系统导航栏颜色
        app.updateNavigationBarColor(app.globalData.theme);

        // 更新自定义TabBar状态
        if (typeof this.getTabBar === 'function' && this.getTabBar()) {
            this.getTabBar().updateSelected(0);
            this.getTabBar().updateTheme(app.globalData.theme);
        }
    },

    // 刷新用户信息
    async refreshUserInfo() {
        if (!app.globalData.isAuthenticated) return;

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
                this.setData({ userInfo: userData });
            }
        } catch (err) {
            console.error('刷新用户信息失败:', err);
        }
    },

    // 初始化页面
    initPage() {
        this.setData({
            theme: app.globalData.theme,
            isAuthenticated: app.globalData.isAuthenticated,
            userInfo: app.globalData.userInfo
        });
    },

    // 切换主题
    toggleTheme() {
        const newTheme = app.toggleTheme();
        this.setData({ theme: newTheme });

        // 同步更新TabBar主题
        if (typeof this.getTabBar === 'function' && this.getTabBar()) {
            this.getTabBar().updateTheme(newTheme);
        }
    },

    // 获取数据（带缓存策略）
    async fetchData() {
        const CACHE_KEY = 'home_data_cache';
        const isAuthenticated = app.globalData.isAuthenticated;

        // 1. 先尝试从缓存读取数据，实现秒开
        try {
            const cachedData = wx.getStorageSync(CACHE_KEY);
            if (cachedData && cachedData.timestamp) {
                // 缓存有效期：5分钟
                const isExpired = Date.now() - cachedData.timestamp > 5 * 60 * 1000;
                // 检查登录状态是否一致
                const isSameAuthState = cachedData.isAuthenticated === isAuthenticated;
                // 检查缓存数据格式是否正确（必须有 name 字段）
                const upcomingValid = !cachedData.upcomingTournaments?.length ||
                    cachedData.upcomingTournaments[0].name !== undefined;
                const registeredValid = !cachedData.myRegisteredTournaments?.length ||
                    cachedData.myRegisteredTournaments[0].name !== undefined;
                const isValidFormat = upcomingValid && registeredValid;

                if (!isExpired && isSameAuthState && isValidFormat) {
                    // 立即显示缓存数据
                    this.setData({
                        loading: false,
                        upcomingTournaments: cachedData.upcomingTournaments || [],
                        myRegisteredTournaments: cachedData.myRegisteredTournaments || [],
                        hasUpcomingRegisteredTournaments: (cachedData.myRegisteredTournaments || []).length > 0
                    });
                }
            }
        } catch (e) {
            console.warn('读取缓存失败:', e);
        }

        // 2. 后台获取最新数据
        try {
            // 获取所有活动
            const matchesRes = await api.matches.list();

            // 映射数据
            let matches = matchesRes.map(m => mappers.mapBackendToFrontend(m));

            let upcomingTournaments = [];
            let myRegisteredTournaments = [];

            // 如果已登录，获取我的报名
            if (isAuthenticated) {
                try {
                    const enrollmentsRes = await api.enrollments.myList();

                    // 获取每个活动的详细报名信息以准确计算排名
                    const uniqueMatchIds = [...new Set(enrollmentsRes.map(e => e.match_id))];
                    const detailsMap = {};

                    await Promise.all(uniqueMatchIds.map(async (mId) => {
                        try {
                            const details = await api.enrollments.list(mId);
                            detailsMap[String(mId)] = details;
                        } catch (e) {
                            console.error(e);
                        }
                    }));

                    // 计算我的报名数量（只计算上场人员，不包括候补）
                    const myRealCountsMap = {};
                    uniqueMatchIds.forEach(mId => {
                        const mIdStr = String(mId);
                        const allEnrollments = detailsMap[mIdStr] || [];

                        // 筛选出type为player的报名（上场人员），不包括candidate（候补）
                        const playerEnrollments = allEnrollments.filter(e => e.type === 'player');

                        // 统计我的上场报名数量
                        const myCount = playerEnrollments.filter(p => String(p.user_id) === String(app.globalData.userInfo?.id)).length;
                        myRealCountsMap[mIdStr] = myCount;
                    });

                    // 更新活动数据
                    matches = matches.map(m => ({
                        ...m,
                        myRegistrationCount: myRealCountsMap[m.id] || 0
                    }));

                    // 构建我报名的活动列表
                    const groupedEnrollments = {};
                    enrollmentsRes.forEach(e => {
                        const mId = String(e.match_id);
                        if (!groupedEnrollments[mId]) {
                            groupedEnrollments[mId] = [];
                        }
                        groupedEnrollments[mId].push(e);
                    });

                    myRegisteredTournaments = Object.values(groupedEnrollments).map(group => {
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

                        let label = '已报名';
                        if (selfEnrollment && proxyCount > 0) {
                            label = `已报名 代报名${proxyCount}人`;
                        } else if (!selfEnrollment && proxyCount > 0) {
                            label = `代报名${proxyCount}人`;
                        }

                        return {
                            ...frontendMatch,
                            enrollmentId: e.id,
                            myRegistrationCount: myRealCountsMap[String(e.match_id)] || 0,
                            isSelfEnrolled: !!selfEnrollment,
                            proxyCount: proxyCount,
                            customStatusLabel: label // Keep for backward compatibility if needed
                        };
                    }).filter(t => ['pre-registration', 'registration', 'finished-pending'].includes(t.status));

                    // 获取已报名活动的ID集合
                    const myRegisteredIds = new Set(Object.keys(groupedEnrollments));

                    // 过滤即将开始的活动（排除已报名的）
                    upcomingTournaments = matches.filter(m =>
                        ['pre-registration', 'registration'].includes(m.status) &&
                        !myRegisteredIds.has(String(m.id))
                    );
                } catch (err) {
                    console.error('获取报名失败:', err);
                    upcomingTournaments = matches.filter(m =>
                        ['pre-registration', 'registration'].includes(m.status)
                    );
                }
            } else {
                // 未登录
                upcomingTournaments = matches.filter(m =>
                    ['pre-registration', 'registration'].includes(m.status)
                );
            }

            // 3. 一次性更新所有数据（合并 setData）
            this.setData({
                loading: false,
                upcomingTournaments,
                myRegisteredTournaments,
                hasUpcomingRegisteredTournaments: myRegisteredTournaments.length > 0
            });

            // 4. 保存到缓存
            try {
                wx.setStorageSync(CACHE_KEY, {
                    timestamp: Date.now(),
                    isAuthenticated,
                    upcomingTournaments,
                    myRegisteredTournaments
                });
            } catch (e) {
                console.warn('保存缓存失败:', e);
            }
        } catch (err) {
            console.error('获取数据失败:', err);
            this.setData({ loading: false });
            wx.showToast({
                title: '加载失败',
                icon: 'none'
            });
        }
    },

    // 登出
    handleLogout() {
        app.logout();
        this.setData({
            isAuthenticated: false,
            userInfo: null,
            myRegisteredTournaments: [],
            hasUpcomingRegisteredTournaments: false
        });
        wx.showToast({
            title: '已退出登录',
            icon: 'success'
        });
    },

    // 跳转到登录页
    goToLogin() {
        wx.navigateTo({ url: '/pages/login/login' });
    },

    // 跳转到注册页
    goToRegister() {
        wx.navigateTo({ url: '/pages/register/register' });
    },

    // 跳转到管理中心
    goToAdmin() {
        wx.navigateTo({ url: '/pages/admin/admin' });
    },

    // 下拉刷新
    onPullDownRefresh() {
        this.fetchData().then(() => {
            wx.stopPullDownRefresh();
        });
    },

    // 分享活动给好友
    onShareAppMessage(options) {
        // 从分享按钮获取Tournament数据和预生成的分享图片
        const tournament = options.target?.dataset?.tournament;
        const shareImage = options.target?.dataset?.shareImage;

        if (tournament && tournament.id) {
            return {
                title: tournament.name || '有熊来集',
                path: `/pages/tournament-detail/tournament-detail?id=${tournament.id}`,
                imageUrl: shareImage || tournament.image || ''
            };
        }

        // 默认分享
        return {
            title: '有熊来集 - 发现精彩活动',
            path: '/pages/home/home'
        };
    }
});
