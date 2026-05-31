/**
 * 编辑活动页面
 * 与网页版 EditTournament.tsx 完全一致
 */

const app = getApp();
const { api, BASE_URL } = require('../../utils/api.js');
const mappers = require('../../utils/mappers.js');

Page({
    data: {
        theme: 'light',
        tournamentId: '',
        formData: {
            name: '', startDateTime: '', endDateTime: '', location: '',
            maxPlayers: 20, maxFieldPlayers: 10, maxWaitlist: 5,
            totalCost: 0,
            costNote: '',
            description: '', descriptionImages: [], rules: [''], organizer: '', contactInfo: '',
            status: 'pre-registration', image: '',
            proxyLimit: 2,
            visibility: 'public'
        },
        // 分离的日期时间
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        showSettlement: false,
        errors: {},
        isSubmitting: false,
        loading: true,
        showBannerModal: false,
        banners: [],
        statusIndex: 0,
        currentStatusLabel: '预报名',
        statusOptions: [
            { value: 'pre-registration', label: '预报名' },
            { value: 'registration', label: '正式报名' },
            { value: 'finished-pending', label: '待结算' },
            { value: 'finished-completed', label: '已结束' },
            { value: 'cancelled', label: '已取消' }
        ],
        visibilityIndex: 0,
        currentVisibilityLabel: '公开',
        visibilityOptions: [
            { value: 'public', label: '公开' },
            { value: 'user_hidden', label: '用户隐藏' },
            { value: 'fully_hidden', label: '完全隐藏' }
        ]
    },

    onLoad(options) {
        this.setData({ tournamentId: options.id });
        this.initPage();
    },

    async initPage() {
        this.setData({ theme: app.globalData.theme });
        app.updateNavigationBarColor(app.globalData.theme);
        
        try {
            const bannersData = await api.get('/banners');
            const banners = bannersData.map(b => b.url.startsWith('http') ? b.url : app.globalData.staticUrl + b.url.replace('/sportsreg', ''));
            this.setData({ banners });
        } catch (err) {
            console.error('获取Banner失败', err);
            // 降级使用默认
            const staticUrl = app.globalData.staticUrl;
            const banners = [];
            for (let i = 1; i <= 12; i++) {
                const num = String(i).padStart(2, '0');
                banners.push(`${staticUrl}/banner/defaultbanner-${num}.jpg`);
            }
            this.setData({ banners });
        }
        
        this.fetchTournament();
    },

    async fetchTournament() {
        try {
            const res = await api.matches.get(this.data.tournamentId);
            const t = mappers.mapBackendToFrontend(res);

            // 计算状态索引
            const statusIndex = this.data.statusOptions.findIndex(s => s.value === t.status);
            const currentStatusLabel = statusIndex >= 0 ? this.data.statusOptions[statusIndex].label : '预报名';
            const showSettlement = ['finished-pending', 'finished-completed'].includes(t.status);

            // 计算公开状态索引
            const visibilityValue = t.visibility || 'public';
            const visibilityIndex = this.data.visibilityOptions.findIndex(v => v.value === visibilityValue);
            const currentVisibilityLabel = visibilityIndex >= 0 ? this.data.visibilityOptions[visibilityIndex].label : '公开';

            // 解析日期时间
            let startDate = '', startTime = '', endDate = '', endTime = '';
            if (t.startDateTime) {
                const parts = t.startDateTime.split('T');
                startDate = parts[0] || '';
                startTime = (parts[1] || '').substring(0, 5);
            }
            if (t.endDateTime) {
                const parts = t.endDateTime.split('T');
                endDate = parts[0] || '';
                endTime = (parts[1] || '').substring(0, 5);
            }

            // 处理图片路径
            const staticUrl = app.globalData.staticUrl;
            let image = t.image || '';
            if (image && !image.startsWith('http')) {
                image = staticUrl + image.replace('/sportsreg', '');
            }

            // 解析 descriptionImages
            let descriptionImages = [];
            try {
                if (res.config_json) {
                    const config = JSON.parse(res.config_json);
                    if (config.descriptionImages && Array.isArray(config.descriptionImages)) {
                        descriptionImages = config.descriptionImages.map(img => 
                            img.startsWith('http') ? img : staticUrl + img.replace('/sportsreg', '')
                        );
                    }
                }
            } catch (e) { console.error('Parse config error', e); }

            this.setData({
                formData: {
                    name: t.name,
                    startDateTime: t.startDateTime || '',
                    endDateTime: t.endDateTime || '',
                    location: t.location,
                    maxPlayers: t.maxPlayers,
                    maxFieldPlayers: t.maxFieldPlayers || t.maxPlayers,
                    maxWaitlist: t.maxWaitlist || 5,
                    totalCost: t.totalCost || 0,
                    costNote: t.costNote || '',
                    description: t.description || '',
                    descriptionImages: descriptionImages,
                    rules: t.rules && t.rules.length > 0 ? t.rules : [''],
                    organizer: t.organizer || '',
                    contactInfo: t.contactInfo || '',
                    status: t.status,
                    image: image,
                    proxyLimit: t.proxyLimit !== undefined ? t.proxyLimit : 2,
                    visibility: visibilityValue
                },
                startDate,
                startTime,
                endDate,
                endTime,
                showSettlement,
                statusIndex: statusIndex >= 0 ? statusIndex : 0,
                currentStatusLabel,
                visibilityIndex: visibilityIndex >= 0 ? visibilityIndex : 0,
                currentVisibilityLabel,
                loading: false
            });
        } catch (err) {
            console.error('Fetch tournament error', err);
            wx.showToast({ title: '加载失败', icon: 'none' });
            this.setData({ loading: false });
        }
    },

    toggleTheme() { this.setData({ theme: app.toggleTheme() }); },
    goBack() { wx.navigateBack({ delta: 1 }); },
    stopPropagation() { },

    // 日期时间选择方法
    onStartDateChange(e) {
        const date = e.detail.value;
        this.setData({ startDate: date });
        this.updateDateTime('start');
    },

    onStartTimeChange(e) {
        const time = e.detail.value;
        this.setData({ startTime: time });
        this.updateDateTime('start');
    },

    onEndDateChange(e) {
        const date = e.detail.value;
        this.setData({ endDate: date });
        this.updateDateTime('end');
    },

    onEndTimeChange(e) {
        const time = e.detail.value;
        this.setData({ endTime: time });
        this.updateDateTime('end');
    },

    updateDateTime(type) {
        if (type === 'start') {
            const { startDate, startTime } = this.data;
            if (startDate && startTime) {
                const dateTime = `${startDate}T${startTime}`;
                this.setData({ 'formData.startDateTime': dateTime });
            }
        } else {
            const { endDate, endTime } = this.data;
            if (endDate && endTime) {
                const dateTime = `${endDate}T${endTime}`;
                this.setData({ 'formData.endDateTime': dateTime });
            }
        }
    },

    onInput(e) {
        const field = e.currentTarget.dataset.field;
        let value = e.detail.value;
        if (['maxPlayers', 'maxFieldPlayers', 'maxWaitlist', 'totalCost', 'proxyLimit'].includes(field)) {
            value = parseInt(value) || 0;
        }
        this.setData({ [`formData.${field}`]: value, [`errors.${field}`]: '' });
    },

    onStatusChange(e) {
        const index = parseInt(e.detail.value);
        const status = this.data.statusOptions[index].value;
        const label = this.data.statusOptions[index].label;
        this.setData({
            'formData.status': status,
            statusIndex: index,
            currentStatusLabel: label
        });
    },

    onVisibilityChange(e) {
        const index = parseInt(e.detail.value);
        const visibility = this.data.visibilityOptions[index].value;
        const label = this.data.visibilityOptions[index].label;
        this.setData({
            'formData.visibility': visibility,
            visibilityIndex: index,
            currentVisibilityLabel: label
        });
    },

    onRuleInput(e) {
        const rules = [...this.data.formData.rules];
        rules[e.currentTarget.dataset.index] = e.detail.value;
        this.setData({ 'formData.rules': rules });
    },

    addRule() { this.setData({ 'formData.rules': [...this.data.formData.rules, ''] }); },

    removeRule(e) {
        if (this.data.formData.rules.length <= 1) return;
        this.setData({ 'formData.rules': this.data.formData.rules.filter((_, i) => i !== e.currentTarget.dataset.index) });
    },

    showBannerSelector() { this.setData({ showBannerModal: true }); },
    closeBannerModal() { this.setData({ showBannerModal: false }); },
    selectBanner(e) { this.setData({ 'formData.image': e.currentTarget.dataset.banner, showBannerModal: false }); },

    // 图片上传
    uploadDescriptionImage() {
        const that = this;
        wx.chooseMedia({
            count: 9,
            mediaType: ['image'],
            sourceType: ['album', 'camera'],
            success(res) {
                wx.showLoading({ title: '处理中...' });
                const tempFiles = res.tempFiles;
                that.processAndUploadImages(tempFiles);
            }
        });
    },

    async processAndUploadImages(tempFiles) {
        const token = wx.getStorageSync('token');
        const uploadedUrls = [];

        try {
            for (let i = 0; i < tempFiles.length; i++) {
                // 压缩图片
                const compressRes = await new Promise((resolve, reject) => {
                    wx.compressImage({
                        src: tempFiles[i].tempFilePath,
                        quality: 80,
                        success: resolve,
                        fail: reject
                    });
                });

                // 上传
                const uploadRes = await new Promise((resolve, reject) => {
                    wx.uploadFile({
                        url: BASE_URL + '/upload',
                        filePath: compressRes.tempFilePath,
                        name: 'image',
                        header: {
                            'Authorization': token ? `Bearer ${token}` : ''
                        },
                        success: (res) => {
                            if (res.statusCode === 200) {
                                const data = JSON.parse(res.data);
                                resolve(data.url);
                            } else {
                                let errMsg = '上传失败';
                                try {
                                    const errData = JSON.parse(res.data);
                                    errMsg = errData.error || errMsg;
                                } catch (e) {}
                                console.error('Upload failed:', res.statusCode, res.data);
                                reject(new Error(errMsg));
                            }
                        },
                        fail: reject
                    });
                });
                
                // 将 /sportsreg/images/... 转换为全路径
                const staticUrl = app.globalData.staticUrl;
                const fullUrl = staticUrl + uploadRes.replace('/sportsreg', '');
                uploadedUrls.push(fullUrl);
            }

            const currentImages = this.data.formData.descriptionImages || [];
            this.setData({
                'formData.descriptionImages': [...currentImages, ...uploadedUrls]
            });
            wx.hideLoading();
            wx.showToast({ title: '上传成功', icon: 'success' });
        } catch (err) {
            wx.hideLoading();
            wx.showToast({ title: '图片上传失败', icon: 'none' });
            console.error(err);
        }
    },

    removeDescriptionImage(e) {
        const index = e.currentTarget.dataset.index;
        const images = this.data.formData.descriptionImages || [];
        images.splice(index, 1);
        this.setData({
            'formData.descriptionImages': images
        });
    },

    previewDescriptionImage(e) {
        const url = e.currentTarget.dataset.url;
        const images = this.data.formData.descriptionImages || [];
        wx.previewImage({
            current: url,
            urls: images
        });
    },

    validateForm() {
        const errors = {};
        const { formData } = this.data;
        if (!formData.name || formData.name.length < 2) errors.name = '活动名称至少2个字符';
        if (!formData.startDateTime) errors.startDateTime = '请选择开始时间';
        if (!formData.location || formData.location.length < 2) errors.location = '请输入活动地点';
        if (!formData.description || formData.description.length < 5) errors.description = '活动描述至少5个字符';

        // 验证: 最大上场人数 + 最大候补人数 <= 最大参与人数
        if (formData.maxPlayers && formData.maxFieldPlayers && formData.maxWaitlist !== undefined) {
            const maxPlayers = Number(formData.maxPlayers) || 0;
            const maxFieldPlayers = Number(formData.maxFieldPlayers) || 0;
            const maxWaitlist = Number(formData.maxWaitlist) || 0;
            if (maxFieldPlayers + maxWaitlist > maxPlayers) {
                errors.maxPlayers = `最大上场人数(${maxFieldPlayers}) + 最大候补人数(${maxWaitlist}) 不能超过最大参与人数(${maxPlayers})`;
            }
        }

        this.setData({ errors });
        return Object.keys(errors).length === 0;
    },

    async handleSubmit() {
        if (!this.validateForm()) {
            // 显示第一个具体的错误信息
            const firstError = Object.values(this.data.errors)[0];
            wx.showToast({ title: firstError || '请检查表单', icon: 'none', duration: 3000 });
            return;
        }

        this.setData({ isSubmitting: true });

        try {
            const { formData, tournamentId } = this.data;
            const staticUrl = app.globalData.staticUrl;

            const data = {
                title: formData.name,
                description: formData.description,
                time: formData.startDateTime.replace('T', ' '),
                location: formData.location,
                max_players: formData.maxPlayers,
                max_waitlist: formData.maxWaitlist,
                duration: 90,
                status: formData.status,
                proxy_limit: formData.proxyLimit,
                visibility: formData.visibility || 'public',
                config_json: JSON.stringify({
                    start_datetime: formData.startDateTime,
                    end_datetime: formData.endDateTime,
                    maxFieldPlayers: formData.maxFieldPlayers,
                    maxWaitlist: formData.maxWaitlist,
                    totalCost: formData.totalCost,
                    costNote: formData.costNote || '',
                    rules: formData.rules.filter(r => r.trim()),
                    organizer: formData.organizer,
                    contactInfo: formData.contactInfo,
                    image: formData.image.replace(staticUrl, '/sportsreg'),
                    descriptionImages: (formData.descriptionImages || []).map(img => img.replace(staticUrl, '/sportsreg'))
                })
            };

            await api.matches.update(tournamentId, data);

            wx.showToast({ title: '保存成功', icon: 'success' });
            setTimeout(() => wx.navigateBack({ delta: 1 }), 1000);
        } catch (err) {
            wx.showToast({ title: err.error || '保存失败', icon: 'none' });
        } finally {
            this.setData({ isSubmitting: false });
        }
    },

    stopPropagation() { }
});
