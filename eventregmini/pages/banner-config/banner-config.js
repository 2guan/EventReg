/**
 * 活动图片配置页面
 * 管理 Banner 默认图片和自定义封面
 */

const app = getApp();
const { api, BASE_URL } = require('../../utils/api.js');

Page({
    data: {
        theme: 'light',
        defaultBanners: [],
        customBanners: [],
        loading: true,
        uploadingId: null,
        refreshKey: 0
    },

    onLoad() {
        this.initPage();
    },

    onShow() {
        app.updateNavigationBarColor(app.globalData.theme);
        this.loadBanners();
    },

    initPage() {
        this.setData({
            theme: app.globalData.theme
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

    // 返回上一页
    goBack() {
        wx.navigateBack({ delta: 1 });
    },

    // 加载 Banner 列表
    async loadBanners() {
        this.setData({ loading: true });

        try {
            const banners = await api.get('/banners');

            // 添加完整 URL 并分组
            const staticUrl = app.globalData.staticUrl;
            const mapped = banners.map(b => ({
                ...b,
                fullUrl: staticUrl + b.url.replace('/sportsreg', '') + '?t=' + this.data.refreshKey
            }));

            this.setData({
                defaultBanners: mapped.filter(b => !b.isCustom),
                customBanners: mapped.filter(b => b.isCustom)
            });
        } catch (err) {
            console.error('加载 Banner 失败:', err);
            wx.showToast({
                title: '加载失败',
                icon: 'none'
            });
        } finally {
            this.setData({ loading: false });
        }
    },

    // 替换默认 Banner
    async uploadBanner(e) {
        const bannerId = e.currentTarget.dataset.id;

        if (this.data.uploadingId !== null) return;

        try {
            const res = await wx.chooseMedia({
                count: 1,
                mediaType: ['image'],
                sourceType: ['album', 'camera'],
                sizeType: ['compressed']
            });

            const tempFilePath = res.tempFiles[0].tempFilePath;
            this.setData({ uploadingId: bannerId });

            const token = wx.getStorageSync('token');
            await new Promise((resolve, reject) => {
                wx.uploadFile({
                    url: BASE_URL + '/banners/' + bannerId,
                    filePath: tempFilePath,
                    name: 'banner',
                    header: {
                        'Authorization': 'Bearer ' + token
                    },
                    success: (res) => {
                        if (res.statusCode === 200) {
                            resolve(JSON.parse(res.data));
                        } else {
                            let errMsg = '上传失败';
                            try { errMsg = JSON.parse(res.data).error || errMsg; } catch (e) {}
                            reject(new Error(errMsg));
                        }
                    },
                    fail: reject
                });
            });

            wx.showToast({ title: `Banner ${bannerId} 替换成功`, icon: 'success' });
            this.setData({ refreshKey: this.data.refreshKey + 1 });
            this.loadBanners();

        } catch (err) {
            if (err.errMsg && err.errMsg.includes('cancel')) return;
            console.error('上传失败:', err);
            wx.showToast({ title: err.message || '上传失败', icon: 'none' });
        } finally {
            this.setData({ uploadingId: null });
        }
    },

    // 上传自定义 Banner
    async uploadCustomBanner() {
        if (this.data.uploadingId !== null) return;

        try {
            const res = await wx.chooseMedia({
                count: 1,
                mediaType: ['image'],
                sourceType: ['album', 'camera'],
                sizeType: ['compressed']
            });

            const tempFilePath = res.tempFiles[0].tempFilePath;
            this.setData({ uploadingId: 'custom' });

            // 压缩图片
            let filePath = tempFilePath;
            try {
                const compressRes = await new Promise((resolve, reject) => {
                    wx.compressImage({
                        src: tempFilePath,
                        quality: 80,
                        success: resolve,
                        fail: reject
                    });
                });
                filePath = compressRes.tempFilePath;
            } catch (e) {
                console.warn('压缩失败，使用原图:', e);
            }

            const token = wx.getStorageSync('token');
            await new Promise((resolve, reject) => {
                wx.uploadFile({
                    url: BASE_URL + '/banners/custom',
                    filePath: filePath,
                    name: 'banner',
                    header: {
                        'Authorization': 'Bearer ' + token
                    },
                    success: (res) => {
                        if (res.statusCode === 200) {
                            resolve(JSON.parse(res.data));
                        } else {
                            let errMsg = '上传失败';
                            try { errMsg = JSON.parse(res.data).error || errMsg; } catch (e) {}
                            reject(new Error(errMsg));
                        }
                    },
                    fail: reject
                });
            });

            wx.showToast({ title: '自定义封面上传成功', icon: 'success' });
            this.setData({ refreshKey: this.data.refreshKey + 1 });
            this.loadBanners();

        } catch (err) {
            if (err.errMsg && err.errMsg.includes('cancel')) return;
            console.error('上传失败:', err);
            wx.showToast({ title: err.message || '上传失败', icon: 'none' });
        } finally {
            this.setData({ uploadingId: null });
        }
    },

    // 删除自定义 Banner
    async deleteCustomBanner(e) {
        const filename = e.currentTarget.dataset.filename;

        const confirmed = await new Promise(resolve => {
            wx.showModal({
                title: '确认删除',
                content: '确定要删除这个自定义封面吗？',
                confirmColor: '#ef4444',
                success: (res) => resolve(res.confirm)
            });
        });

        if (!confirmed) return;

        try {
            await api.delete('/banners/custom/' + filename);
            wx.showToast({ title: '删除成功', icon: 'success' });
            this.setData({ refreshKey: this.data.refreshKey + 1 });
            this.loadBanners();
        } catch (err) {
            console.error('删除失败:', err);
            wx.showToast({ title: err.error || '删除失败', icon: 'none' });
        }
    },

    // 下拉刷新
    onPullDownRefresh() {
        this.loadBanners().then(() => {
            wx.stopPullDownRefresh();
        });
    }
});
