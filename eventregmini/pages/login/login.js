/**
 * 登录页面
 * 与网页版 Login.tsx 完全一致
 */

const app = getApp();
const { api } = require('../../utils/api.js');

Page({
    data: {
        username: '',
        password: '',
        showPassword: false,
        isSubmitting: false,
        errors: {},
        theme: 'light',

        // 微信登录相关
        showWxProfileModal: false,
        wxAvatar: '',
        wxNickname: '',
        wxLoginCode: ''
    },

    onLoad() {
        this.setData({ theme: app.globalData.theme });

        // 如果已登录，跳转到首页
        if (app.globalData.isAuthenticated) {
            wx.switchTab({ url: '/pages/home/home' });
        }
    },

    onShow() {
        this.setData({ theme: app.globalData.theme });
        app.updateNavigationBarColor(app.globalData.theme);
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

    // 输入用户名
    onUsernameInput(e) {
        this.setData({
            username: e.detail.value,
            'errors.username': ''
        });
    },

    // 输入密码
    onPasswordInput(e) {
        this.setData({
            password: e.detail.value,
            'errors.password': ''
        });
    },

    // 切换密码显示
    togglePasswordVisibility() {
        this.setData({ showPassword: !this.data.showPassword });
    },

    // 表单验证
    validateForm() {
        const errors = {};

        if (!this.data.username || this.data.username.length < 3) {
            errors.username = '用户名至少3个字符';
        }

        if (!this.data.password || this.data.password.length < 3) {
            errors.password = '密码至少3个字符';
        }

        this.setData({ errors });
        return Object.keys(errors).length === 0;
    },

    // 提交登录
    async handleSubmit() {
        if (!this.validateForm()) return;

        this.setData({ isSubmitting: true });

        // 如果已有登录状态，先登出旧账户，确保 token 被清除
        if (app.globalData.isAuthenticated) {
            console.log('[Login] Clearing previous login state');
            app.logout();
        }

        try {
            const res = await api.auth.login(this.data.username, this.data.password);

            if (res.token) {
                // 保存登录状态
                const userInfo = {
                    id: res.user.id,
                    username: res.user.username,
                    nickname: res.user.nickname,
                    avatar: res.user.avatar,
                    role: res.user.role,
                    points: res.user.points || 0,
                    status: res.user.status
                };

                app.login(res.token, userInfo);

                wx.showToast({
                    title: '登录成功',
                    icon: 'success'
                });

                // 检查用户状态
                if (userInfo.status === 'pending') {
                    wx.showModal({
                        title: '提示',
                        content: '您的账号正在审核中，部分功能暂时无法使用',
                        showCancel: false,
                        confirmText: '知道了'
                    });
                }

                // 跳转到首页
                setTimeout(() => {
                    wx.switchTab({ url: '/pages/home/home' });
                }, 500);
            }
        } catch (err) {
            console.error('登录失败:', err);
            wx.showToast({
                title: err.error || '登录失败',
                icon: 'none'
            });
        } finally {
            this.setData({ isSubmitting: false });
        }
    },

    // 微信一键登录
    async handleWxLogin() {
        try {
            this.setData({ isSubmitting: true });

            // 如果已有登录状态，先登出旧账户，确保 token 被清除
            if (app.globalData.isAuthenticated) {
                console.log('[WxLogin] Clearing previous login state');
                app.logout();
            }

            // 第一步：获取微信登录code
            const loginRes = await new Promise((resolve, reject) => {
                wx.login({
                    success: resolve,
                    fail: reject
                });
            });

            if (!loginRes.code) {
                throw new Error('获取登录凭证失败');
            }

            // 第二步：先发送code到后端检查用户是否存在
            const res = await api.auth.wxLogin(loginRes.code, '', '');

            if (res.token) {
                // 用户已存在，直接登录成功
                // 处理头像URL：将相对路径转换为完整URL
                let avatarUrl = res.user.avatar;
                if (avatarUrl && avatarUrl.startsWith('/sportsreg')) {
                    avatarUrl = app.globalData.staticUrl + avatarUrl.replace('/sportsreg', '');
                } else if (!avatarUrl) {
                    avatarUrl = app.globalData.defaultAvatar;
                }

                const userInfo = {
                    id: res.user.id,
                    username: res.user.username,
                    nickname: res.user.nickname,
                    avatar: avatarUrl,
                    role: res.user.role,
                    points: res.user.points || 0,
                    status: res.user.status
                };

                app.login(res.token, userInfo);

                wx.showToast({
                    title: '登录成功',
                    icon: 'success'
                });

                setTimeout(() => {
                    wx.switchTab({ url: '/pages/home/home' });
                }, 500);
            } else if (res.needRegister) {
                // 用户不存在，需要注册，打开资料获取模态框
                this.setData({
                    wxLoginCode: loginRes.code,
                    wxAvatar: '',
                    wxNickname: '',
                    showWxProfileModal: true
                });
            } else if (res.needApproval) {
                // 新用户需要管理员审核（不应该在这里出现，但以防万一）
                wx.showModal({
                    title: '账号待审核',
                    content: '您的账号正在等待管理员审核，审核通过后即可登录',
                    showCancel: false,
                    confirmText: '知道了'
                });
            }
        } catch (err) {
            console.error('微信登录失败:', err);
            wx.showToast({
                title: err.error || err.message || '微信登录失败',
                icon: 'none'
            });
        } finally {
            this.setData({ isSubmitting: false });
        }
    },

    // 选择头像回调
    onChooseAvatar(e) {
        const avatarUrl = e.detail.avatarUrl;
        if (avatarUrl) {
            this.setData({ wxAvatar: avatarUrl });
        }
    },

    // 昵称输入
    onNicknameChange(e) {
        this.setData({ wxNickname: e.detail.value });
    },

    // 昵称输入失焦
    onNicknameBlur(e) {
        this.setData({ wxNickname: e.detail.value });
    },

    // 关闭微信资料模态框
    closeWxProfileModal() {
        this.setData({
            showWxProfileModal: false,
            wxAvatar: '',
            wxNickname: '',
            wxLoginCode: ''
        });
    },

    // 阻止事件冒泡
    stopPropagation() { },

    // 确认微信资料并完成登录
    async confirmWxProfile() {
        const { wxAvatar, wxNickname } = this.data;

        if (!wxAvatar || !wxNickname) {
            wx.showToast({
                title: '请先选择头像并输入昵称',
                icon: 'none'
            });
            return;
        }

        try {
            this.setData({ isSubmitting: true });

            // 先上传头像到服务器获取永久URL
            let avatarUrl = wxAvatar;

            // 检查是否是临时头像URL，如果是需要上传
            if (wxAvatar.startsWith('http://tmp') || wxAvatar.startsWith('wxfile://')) {
                wx.showLoading({ title: '上传头像中...' });

                try {
                    const uploadRes = await new Promise((resolve, reject) => {
                        wx.uploadFile({
                            url: app.globalData.baseUrl + '/auth/upload-avatar',
                            filePath: wxAvatar,
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
                        avatarUrl = uploadRes.avatarUrl;
                    }
                } catch (uploadErr) {
                    console.error('头像上传失败:', uploadErr);
                    // 上传失败时使用默认头像
                    avatarUrl = '/sportsreg/face/defaultface-user (1).jpg';
                } finally {
                    wx.hideLoading();
                }
            }

            // 重新获取code（因为之前的code已经被使用过了）
            const loginRes = await new Promise((resolve, reject) => {
                wx.login({
                    success: resolve,
                    fail: reject
                });
            });

            if (!loginRes.code) {
                throw new Error('获取登录凭证失败');
            }

            // 发送新的code到后端（带上上传后的头像URL和昵称）
            const res = await api.auth.wxLogin(loginRes.code, wxNickname, avatarUrl);

            if (res.token) {
                // 登录/注册成功
                // 处理头像URL：将相对路径转换为完整URL
                let finalAvatarUrl = res.user.avatar;
                if (finalAvatarUrl && finalAvatarUrl.startsWith('/sportsreg')) {
                    finalAvatarUrl = app.globalData.staticUrl + finalAvatarUrl.replace('/sportsreg', '');
                } else if (!finalAvatarUrl) {
                    finalAvatarUrl = app.globalData.defaultAvatar;
                }

                const userInfo = {
                    id: res.user.id,
                    username: res.user.username,
                    nickname: res.user.nickname,
                    avatar: finalAvatarUrl,
                    role: res.user.role,
                    points: res.user.points || 0,
                    status: res.user.status
                };

                app.login(res.token, userInfo);

                this.closeWxProfileModal();

                wx.showToast({
                    title: '登录成功',
                    icon: 'success'
                });

                setTimeout(() => {
                    wx.switchTab({ url: '/pages/home/home' });
                }, 500);
            } else if (res.needApproval) {
                // 新用户需要管理员审核
                this.closeWxProfileModal();
                wx.showModal({
                    title: '注册成功',
                    content: '您的账号正在等待管理员审核，审核通过后即可登录',
                    showCancel: false,
                    confirmText: '知道了'
                });
            }
        } catch (err) {
            console.error('微信登录失败:', err);
            wx.showToast({
                title: err.error || err.message || '微信登录失败',
                icon: 'none'
            });
        } finally {
            this.setData({ isSubmitting: false });
        }
    },

    // 跳转到注册页
    goToRegister() {
        wx.navigateTo({ url: '/pages/register/register' });
    }
});
