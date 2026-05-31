/**
 * 注册页面
 * 与网页版 Register.tsx 完全一致
 */

const app = getApp();
const { api } = require('../../utils/api.js');

Page({
    data: {
        username: '',
        nickname: '',
        password: '',
        confirmPassword: '',
        avatar: '',
        showPassword: false,
        showConfirmPassword: false,
        showAvatarModal: false,
        isSubmitting: false,
        errors: {},
        theme: 'light',
        avatars: [],
        openid: '' // 微信登录传入的openid
    },

    onLoad(options) {
        this.setData({ theme: app.globalData.theme });

        // 生成头像列表
        const avatars = [];
        const staticUrl = app.globalData.staticUrl;
        for (let i = 1; i <= 30; i++) {
            avatars.push(`${staticUrl}/face/defaultface-user%20(${i}).jpg`);
        }

        this.setData({
            avatars,
            avatar: avatars[0],
            openid: options.openid || ''
        });
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

    // 输入昵称
    onNicknameInput(e) {
        this.setData({
            nickname: e.detail.value,
            'errors.nickname': ''
        });
    },

    // 输入密码
    onPasswordInput(e) {
        this.setData({
            password: e.detail.value,
            'errors.password': ''
        });
    },

    // 输入确认密码
    onConfirmPasswordInput(e) {
        this.setData({
            confirmPassword: e.detail.value,
            'errors.confirmPassword': ''
        });
    },

    // 切换密码显示
    togglePasswordVisibility() {
        this.setData({ showPassword: !this.data.showPassword });
    },

    // 切换确认密码显示
    toggleConfirmPasswordVisibility() {
        this.setData({ showConfirmPassword: !this.data.showConfirmPassword });
    },

    // 显示头像选择器
    showAvatarSelector() {
        this.setData({ showAvatarModal: true });
    },

    // 关闭头像选择器
    closeAvatarModal() {
        this.setData({ showAvatarModal: false });
    },

    // 选择头像
    selectAvatar(e) {
        const avatar = e.currentTarget.dataset.avatar;
        this.setData({
            avatar,
            showAvatarModal: false
        });
    },

    // 使用微信头像
    async chooseWxAvatar(e) {
        const avatarUrl = e.detail.avatarUrl;
        if (avatarUrl) {
            this.setData({ avatar: avatarUrl });
        }
    },

    // 使用微信昵称
    onNicknameBlur(e) {
        if (e.detail.value) {
            this.setData({ nickname: e.detail.value });
        }
    },

    // 表单验证
    validateForm() {
        const errors = {};

        if (!this.data.username || this.data.username.length < 3) {
            errors.username = '用户名至少3个字符';
        } else if (this.data.username.length > 20) {
            errors.username = '用户名最多20个字符';
        }

        if (!this.data.nickname || this.data.nickname.length < 2) {
            errors.nickname = '昵称至少2个字符';
        } else if (this.data.nickname.length > 20) {
            errors.nickname = '昵称最多20个字符';
        }

        if (!this.data.password || this.data.password.length < 6) {
            errors.password = '密码至少6个字符';
        } else if (this.data.password.length > 20) {
            errors.password = '密码最多20个字符';
        }

        if (this.data.password !== this.data.confirmPassword) {
            errors.confirmPassword = '两次输入的密码不一致';
        }

        this.setData({ errors });
        return Object.keys(errors).length === 0;
    },

    // 提交注册
    async handleSubmit() {
        if (!this.validateForm()) return;

        this.setData({ isSubmitting: true });

        try {
            const data = {
                username: this.data.username,
                nickname: this.data.nickname,
                password: this.data.password,
                avatar: this.data.avatar
            };

            // 如果有openid，附加上
            if (this.data.openid) {
                data.openid = this.data.openid;
            }

            await api.auth.register(data);

            wx.showToast({
                title: '注册成功',
                icon: 'success'
            });

            // 跳转到登录页
            setTimeout(() => {
                wx.navigateTo({ url: '/pages/login/login' });
            }, 1000);
        } catch (err) {
            console.error('注册失败:', err);
            wx.showToast({
                title: err.error || '注册失败',
                icon: 'none'
            });
        } finally {
            this.setData({ isSubmitting: false });
        }
    },

    // 跳转到登录页
    goToLogin() {
        wx.navigateTo({ url: '/pages/login/login' });
    },

    // 阻止冒泡
    stopPropagation() { }
});
