/**
 * 有熊来集 - 小程序入口文件
 * 全局状态管理和初始化
 */

App({
    globalData: {
        // 用户信息
        userInfo: null,
        isAuthenticated: false,
        token: null,

        // 主题设置
        theme: 'light', // 'light' or 'dark'

        // 服务器配置
        baseUrl: 'https://sportsreg.shenhaimujing.com/sportsreg/api',

        // 静态资源地址
        staticUrl: 'https://sportsreg.shenhaimujing.com/sportsreg',

        // 默认头像
        defaultAvatar: 'https://sportsreg.shenhaimujing.com/sportsreg/face/defaultface-user%20(1).jpg',

        // 默认banner
        defaultBanner: 'https://sportsreg.shenhaimujing.com/sportsreg/banner/defaultbanner-01.jpg',

        // 系统设置
        notificationEnabled: true
    },

    onLaunch: function () {
        console.log('有熊来集 - 小程序启动');

        // 初始化主题
        this.initTheme();

        // 尝试自动登录
        this.autoLogin();

        // 获取系统信息
        this.getSystemInfo();

        // 预加载活动数据（加速Tab切换）
        this.preloadTournamentsData();
    },

    // 初始化主题
    initTheme: function () {
        const theme = wx.getStorageSync('theme') || 'light';
        this.globalData.theme = theme;

        // 设置导航栏颜色
        this.updateNavigationBarColor(theme);
    },

    // 更新导航栏颜色
    updateNavigationBarColor: function (theme) {
        if (theme === 'dark') {
            wx.setNavigationBarColor({
                frontColor: '#ffffff',
                backgroundColor: '#1f2937'
            });
        } else {
            wx.setNavigationBarColor({
                frontColor: '#000000',
                backgroundColor: '#ffffff'
            });
        }
    },

    // 切换主题
    toggleTheme: function () {
        const newTheme = this.globalData.theme === 'light' ? 'dark' : 'light';
        this.globalData.theme = newTheme;
        wx.setStorageSync('theme', newTheme);
        this.updateNavigationBarColor(newTheme);
        return newTheme;
    },

    // 自动登录
    autoLogin: function () {
        const token = wx.getStorageSync('token');
        const userInfo = wx.getStorageSync('userInfo');

        if (token && userInfo) {
            this.globalData.token = token;

            // 处理头像URL：确保是完整URL
            let avatarUrl = userInfo.avatar;
            if (avatarUrl && avatarUrl.startsWith('/sportsreg')) {
                avatarUrl = this.globalData.staticUrl + avatarUrl.replace('/sportsreg', '');
                userInfo.avatar = avatarUrl;
                wx.setStorageSync('userInfo', userInfo);
            }

            this.globalData.userInfo = userInfo;
            this.globalData.isAuthenticated = true;

            // 验证token有效性
            this.verifyToken();
        }
    },

    // 验证token
    verifyToken: async function () {
        try {
            const res = await this.request({
                url: '/auth/me',
                method: 'GET'
            });

            if (res.data) {
                // 处理头像URL：将相对路径转换为完整URL
                let avatarUrl = res.data.avatar;
                if (avatarUrl && avatarUrl.startsWith('/sportsreg')) {
                    avatarUrl = this.globalData.staticUrl + avatarUrl.replace('/sportsreg', '');
                } else if (!avatarUrl) {
                    avatarUrl = this.globalData.defaultAvatar;
                }

                this.globalData.userInfo = {
                    id: res.data.id,
                    username: res.data.username,
                    nickname: res.data.nickname,
                    avatar: avatarUrl,
                    role: res.data.role,
                    points: res.data.points || 0,
                    status: res.data.status
                };
                wx.setStorageSync('userInfo', this.globalData.userInfo);
            }
        } catch (err) {
            console.error('Token验证失败:', err);
            // Token无效，清除登录状态
            this.logout();
        }
    },

    // 登录
    login: function (token, userInfo) {
        this.globalData.token = token;

        // 处理头像URL：将相对路径转换为完整URL
        let avatarUrl = userInfo.avatar;
        if (avatarUrl && avatarUrl.startsWith('/sportsreg')) {
            avatarUrl = this.globalData.staticUrl + avatarUrl.replace('/sportsreg', '');
        } else if (!avatarUrl) {
            avatarUrl = this.globalData.defaultAvatar;
        }

        const processedUserInfo = {
            ...userInfo,
            avatar: avatarUrl
        };

        this.globalData.userInfo = processedUserInfo;
        this.globalData.isAuthenticated = true;

        wx.setStorageSync('token', token);
        wx.setStorageSync('userInfo', processedUserInfo);
    },

    // 登出
    logout: function () {
        this.globalData.token = null;
        this.globalData.userInfo = null;
        this.globalData.isAuthenticated = false;

        wx.removeStorageSync('token');
        wx.removeStorageSync('userInfo');
    },

    // 获取系统信息
    getSystemInfo: function () {
        try {
            // 使用新版 API 替代已废弃的 wx.getSystemInfoSync
            const windowInfo = wx.getWindowInfo();
            const deviceInfo = wx.getDeviceInfo();

            this.globalData.systemInfo = {
                ...windowInfo,
                ...deviceInfo
            };
            this.globalData.statusBarHeight = windowInfo.statusBarHeight;
            this.globalData.windowWidth = windowInfo.windowWidth;
            this.globalData.windowHeight = windowInfo.windowHeight;
        } catch (err) {
            console.error('获取系统信息失败:', err);
        }
    },

    // 封装请求方法
    request: function (options) {
        const that = this;
        return new Promise((resolve, reject) => {
            const url = options.url.startsWith('http') ? options.url : that.globalData.baseUrl + options.url;

            wx.request({
                url: url,
                method: options.method || 'GET',
                data: options.data,
                header: {
                    'Content-Type': 'application/json',
                    'Authorization': that.globalData.token ? `Bearer ${that.globalData.token}` : ''
                },
                success: function (res) {
                    if (res.statusCode === 200) {
                        resolve(res);
                    } else if (res.statusCode === 401) {
                        // Token过期，清除登录状态
                        that.logout();
                        reject({ message: '登录已过期，请重新登录' });
                    } else {
                        reject(res.data || { message: '请求失败' });
                    }
                },
                fail: function (err) {
                    console.error('请求失败:', err);
                    reject({ message: '网络请求失败' });
                }
            });
        });
    },

    // 显示提示
    showToast: function (title, icon = 'none') {
        wx.showToast({
            title: title,
            icon: icon,
            duration: 2000
        });
    },

    // 显示loading
    showLoading: function (title = '加载中...') {
        wx.showLoading({
            title: title,
            mask: true
        });
    },

    // 隐藏loading
    hideLoading: function () {
        wx.hideLoading();
    },

    // 确认对话框
    showModal: function (title, content) {
        return new Promise((resolve) => {
            wx.showModal({
                title: title,
                content: content,
                confirmColor: '#ef4444',
                success: function (res) {
                    resolve(res.confirm);
                }
            });
        });
    },

    // 预加载活动数据（加速Tab切换）
    preloadTournamentsData: async function () {
        try {
            const res = await this.request({
                url: '/matches',
                method: 'GET'
            });

            if (res.data) {
                // 引入映射工具
                const mappers = require('./utils/mappers.js');

                // 将后端数据映射为前端格式
                const tournaments = res.data.map(m => mappers.mapBackendToFrontend(m));

                // 保存到缓存，供首页和全部活动页面使用
                wx.setStorageSync('tournaments_data_cache', {
                    timestamp: Date.now(),
                    isAuthenticated: this.globalData.isAuthenticated,
                    tournaments: tournaments,
                    myEnrollments: []
                });

                wx.setStorageSync('home_data_cache', {
                    timestamp: Date.now(),
                    isAuthenticated: this.globalData.isAuthenticated,
                    upcomingTournaments: tournaments.filter(m => ['pre-registration', 'registration'].includes(m.status)),
                    myRegisteredTournaments: []
                });

                console.log('预加载活动数据成功');
            }
        } catch (err) {
            console.warn('预加载活动数据失败:', err);
        }
    }
});
