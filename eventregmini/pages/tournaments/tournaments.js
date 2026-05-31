/**
 * 全部活动页面
 * 与网页版 Tournaments.tsx 完全一致
 */

const app = getApp();
const { api } = require('../../utils/api.js');
const mappers = require('../../utils/mappers.js');

Page({
    data: {
        theme: 'light',
        isAuthenticated: false,
        userInfo: null,
        tournaments: [],
        myEnrollments: [],  // 我的报名记录
        filteredTournaments: [],
        scopeFilter: 'all',  // 第一层筛选：mine | all
        showStatusFilter: false,  // 是否显示状态筛选菜单
        statusFilter: 'all',  // 第二层筛选
        loading: true,
        emptyMessage: '暂无活动',
        statusTabs: [
            { key: 'all', label: '全部' },
            { key: 'pre-registration', label: '预报名' },
            { key: 'registration', label: '报名中' },
            { key: 'finished-pending', label: '待结算' },
            { key: 'finished-completed', label: '已结束' },
            { key: 'cancelled', label: '已取消' }
        ]
    },

    onLoad() {
        this.initPage();
    },

    onShow() {
        this.initPage();
        this.fetchTournaments();
        app.updateNavigationBarColor(app.globalData.theme);

        // 更新自定义TabBar状态
        if (typeof this.getTabBar === 'function' && this.getTabBar()) {
            this.getTabBar().updateSelected(1);
            this.getTabBar().updateTheme(app.globalData.theme);
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

    // 获取活动列表（带缓存策略）
    async fetchTournaments() {
        const CACHE_KEY = 'tournaments_data_cache';
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
                const isValidFormat = cachedData.tournaments &&
                    cachedData.tournaments.length > 0 &&
                    cachedData.tournaments[0].name !== undefined;

                if (!isExpired && isSameAuthState && isValidFormat) {
                    // 立即显示缓存数据
                    this.setData({
                        loading: false,
                        tournaments: cachedData.tournaments || [],
                        myEnrollments: cachedData.myEnrollments || []
                    });
                    this.filterTournaments();
                }
            }
        } catch (e) {
            console.warn('读取缓存失败:', e);
        }

        // 2. 后台获取最新数据
        try {
            const matchesRes = await api.matches.list();
            let tournaments = matchesRes.map(m => mappers.mapBackendToFrontend(m));

            // 获取我的报名信息
            let myEnrollments = [];
            if (isAuthenticated) {
                try {
                    const enrollmentsRes = await api.enrollments.myList();
                    myEnrollments = enrollmentsRes;

                    const myEnrollmentsRes = enrollmentsRes;
                    const groupedEnrollments = {};
                    myEnrollmentsRes.forEach(e => {
                        const mId = String(e.match_id);
                        if (!groupedEnrollments[mId]) groupedEnrollments[mId] = [];
                        groupedEnrollments[mId].push(e);
                    });

                    const uniqueMatchIds = [...new Set(myEnrollmentsRes.map(e => e.match_id))];
                    const detailsMap = {};

                    await Promise.all(uniqueMatchIds.map(async (mId) => {
                        try {
                            const details = await api.enrollments.list(mId);
                            detailsMap[String(mId)] = details;
                        } catch (e) { }
                    }));

                    const myRealCountsMap = {};
                    const myEnrollmentDetailsMap = {}; // matchId -> { isSelf: boolean, proxyCount: number }

                    uniqueMatchIds.forEach(mId => {
                        const mIdStr = String(mId);
                        const allEnrollments = detailsMap[mIdStr] || [];
                        const matchInfo = tournaments.find(m => m.id === mIdStr);
                        let limit = matchInfo ? (matchInfo.maxFieldPlayers || matchInfo.maxPlayers) : 0;
                        const sorted = [...allEnrollments].sort((a, b) => parseInt(a.id) - parseInt(b.id));
                        const activePlayers = sorted.slice(0, limit);
                        
                        const myActiveEnrollments = activePlayers.filter(p => String(p.user_id) === String(app.globalData.userInfo?.id));
                        const myCount = myActiveEnrollments.length;
                        myRealCountsMap[mIdStr] = myCount;

                        const myAllEnrollments = (groupedEnrollments[mIdStr] || []);
                        const selfEnrollment = myAllEnrollments.find(item => !item.enrolled_for_name);
                        const proxyEnrollments = myAllEnrollments.filter(item => item.enrolled_for_name);
                        
                        myEnrollmentDetailsMap[mIdStr] = {
                            isSelf: !!selfEnrollment,
                            proxyCount: proxyEnrollments.length
                        };
                    });

                    tournaments = tournaments.map(m => ({
                        ...m,
                        myRegistrationCount: myRealCountsMap[m.id] || 0,
                        isSelfEnrolled: myEnrollmentDetailsMap[m.id]?.isSelf || false,
                        proxyCount: myEnrollmentDetailsMap[m.id]?.proxyCount || 0
                    }));
                } catch (err) {
                    console.error('获取报名信息失败:', err);
                }
            }

            // 3. 一次性更新所有数据
            this.setData({
                loading: false,
                tournaments,
                myEnrollments
            });
            this.filterTournaments();

            // 4. 保存到缓存
            try {
                wx.setStorageSync(CACHE_KEY, {
                    timestamp: Date.now(),
                    isAuthenticated,
                    tournaments,
                    myEnrollments
                });
            } catch (e) {
                console.warn('保存缓存失败:', e);
            }
        } catch (err) {
            console.error('获取活动列表失败:', err);
            this.setData({ loading: false });
            wx.showToast({
                title: '加载失败',
                icon: 'none'
            });
        }
    },

    // 第一层筛选：切换范围
    onScopeChange(e) {
        const scope = e.currentTarget.dataset.scope;
        const { scopeFilter, showStatusFilter } = this.data;

        // 如果点击的是当前选中的范围，切换状态筛选菜单的显示
        if (scope === scopeFilter) {
            this.setData({ showStatusFilter: !showStatusFilter });
            return;
        }

        // 切换范围时，显示状态筛选菜单
        this.setData({
            scopeFilter: scope,
            showStatusFilter: true
        });
        this.filterTournaments();
    },

    // 第二层筛选：切换状态
    onStatusChange(e) {
        const status = e.currentTarget.dataset.status;
        this.setData({ statusFilter: status });
        this.filterTournaments();
    },

    // 过滤活动
    filterTournaments() {
        const { tournaments, myEnrollments, scopeFilter, statusFilter } = this.data;

        // 获取我报名的活动ID集合
        const myEnrolledMatchIds = new Set(myEnrollments.map(e => String(e.match_id)));

        let filtered = tournaments;

        // 第一层筛选：范围
        if (scopeFilter === 'mine') {
            filtered = filtered.filter(t => myEnrolledMatchIds.has(String(t.id)));
        }

        // 第二层筛选：状态
        if (statusFilter !== 'all') {
            filtered = filtered.filter(t => t.status === statusFilter);
        }

        // 设置空状态消息
        let emptyMessage = '暂无活动';
        if (scopeFilter === 'mine') {
            emptyMessage = '暂无报名的活动';
        }
        if (statusFilter !== 'all') {
            const statusLabel = this.data.statusTabs.find(t => t.key === statusFilter)?.label || '';
            emptyMessage = `暂无${statusLabel}的活动`;
        }

        this.setData({
            filteredTournaments: filtered,
            emptyMessage
        });
    },

    // 返回上一页
    goBack() {
        wx.navigateBack({ delta: 1 });
    },

    // 下拉刷新
    onPullDownRefresh() {
        this.fetchTournaments().then(() => {
            wx.stopPullDownRefresh();
        });
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
            title: '有熊来集 - 发现精彩活动',
            path: '/pages/tournaments/tournaments'
        };
    }
});
