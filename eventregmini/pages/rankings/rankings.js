/**
 * 积分排行榜页面
 * 与网页版 Rankings.tsx 功能完全一致
 */

const app = getApp();
const { api } = require('../../utils/api.js');

Page({
    data: {
        theme: 'light',
        rankData: [{}, {}, {}], // 初始化前三名占位
        filteredRanks: [],
        searchTerm: '',
        activeTab: 'global',
        myRank: null
    },

    onLoad() {
        this.initPage();
    },

    onShow() {
        this.setData({ theme: app.globalData.theme });
        app.updateNavigationBarColor(app.globalData.theme);
        this.fetchRankings();
    },

    onPullDownRefresh() {
        this.fetchRankings().then(() => {
            wx.stopPullDownRefresh();
        });
    },

    initPage() {
        this.setData({ theme: app.globalData.theme });
        this.fetchRankings();
    },

    toggleTheme() {
        const newTheme = app.toggleTheme();
        this.setData({ theme: newTheme });
    },

    goBack() {
        wx.navigateBack({ delta: 1 });
    },

    async fetchRankings() {
        try {
            wx.showLoading({ title: '加载中...' });

            const res = await api.points.leaderboard();
            const staticUrl = app.globalData.staticUrl;
            const defaultAvatar = staticUrl + '/face/defaultface-user%20(1).jpg';
            const userInfo = app.globalData.userInfo;

            const formatted = res.map((u, idx) => {
                // 处理头像URL
                let avatarUrl = u.avatar || defaultAvatar;
                if (avatarUrl.startsWith('/sportsreg')) {
                    avatarUrl = staticUrl + avatarUrl.replace('/sportsreg', '');
                }

                return {
                    id: String(u.id),
                    name: u.nickname || u.username,
                    points: u.total_points || u.points || 0,
                    rank: idx + 1,
                    avatar: avatarUrl,
                    isMe: userInfo ? u.id === userInfo.id : false
                };
            });

            // 确保前三名数据
            while (formatted.length < 3) {
                formatted.push({
                    id: '',
                    name: '待定',
                    points: 0,
                    rank: formatted.length + 1,
                    avatar: defaultAvatar,
                    isMe: false
                });
            }

            // 找到自己的排名
            let myRank = null;
            if (userInfo) {
                myRank = formatted.find(u => u.isMe) || null;
            }

            this.setData({
                rankData: formatted,
                filteredRanks: formatted,
                myRank
            });

            wx.hideLoading();
        } catch (err) {
            wx.hideLoading();
            console.error('获取排行榜失败:', err);
            wx.showToast({ title: '获取排行榜失败', icon: 'none' });
        }
    },

    onSearchInput(e) {
        const searchTerm = e.detail.value;
        this.setData({ searchTerm });
        this.filterRanks();
    },

    switchTab(e) {
        const tab = e.currentTarget.dataset.tab;
        this.setData({ activeTab: tab });
        this.filterRanks();
    },

    filterRanks() {
        let result = [...this.data.rankData];
        const { searchTerm, activeTab } = this.data;

        // 搜索筛选
        if (searchTerm) {
            result = result.filter(user =>
                user.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // 标签筛选
        if (activeTab === 'friends') {
            // 模拟好友排名（实际应根据关系过滤）
            result = result.slice(0, 5);
        }

        this.setData({ filteredRanks: result });
    }
});
