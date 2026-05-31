/**
 * 创建活动页面
 * 与网页版 CreateTournament.tsx + TournamentForm.tsx 完全一致
 */

const app = getApp();
const { api, BASE_URL } = require('../../utils/api.js');

Page({
    data: {
        theme: 'light',
        formData: {
            name: '',
            startDateTime: '',
            endDateTime: '',
            location: '',
            maxPlayers: 20,
            maxFieldPlayers: 10,
            maxWaitlist: 5,
            totalCost: 0,
            costNote: '',
            description: '',
            descriptionImages: [],
            rules: [''],
            organizer: '',
            contactInfo: '',
            status: 'pre-registration',
            image: '',
            proxyLimit: 2,
            visibility: 'public'
        },
        // 分离的日期时间
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        errors: {},
        isSubmitting: false,
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
        ],
        showTemplateModal: false,
        loadingTemplates: false,
        recentActivities: []
    },

    onLoad() {
        this.initPage();
    },

    async initPage() {
        this.setData({ theme: app.globalData.theme });
        app.updateNavigationBarColor(app.globalData.theme);

        try {
            const bannersData = await api.get('/banners');
            const banners = bannersData.map(b => b.url.startsWith('http') ? b.url : app.globalData.staticUrl + b.url.replace('/sportsreg', ''));
            this.setData({
                banners,
                'formData.image': banners[0] || ''
            });
        } catch (err) {
            console.error('获取Banner失败', err);
            // 降级使用默认
            const staticUrl = app.globalData.staticUrl;
            const banners = [];
            for (let i = 1; i <= 12; i++) {
                const num = String(i).padStart(2, '0');
                banners.push(`${staticUrl}/banner/defaultbanner-${num}.jpg`);
            }
            this.setData({
                banners,
                'formData.image': banners[0]
            });
        }
    },

    toggleTheme() {
        const newTheme = app.toggleTheme();
        this.setData({ theme: newTheme });
    },

    goBack() {
        wx.navigateBack({ delta: 1 });
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
        const index = e.currentTarget.dataset.index;
        const rules = [...this.data.formData.rules];
        rules[index] = e.detail.value;
        this.setData({ 'formData.rules': rules });
    },

    addRule() {
        const rules = [...this.data.formData.rules, ''];
        this.setData({ 'formData.rules': rules });
    },

    removeRule(e) {
        const index = e.currentTarget.dataset.index;
        if (this.data.formData.rules.length <= 1) return;
        const rules = this.data.formData.rules.filter((_, i) => i !== index);
        this.setData({ 'formData.rules': rules });
    },

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

    showBannerSelector() {
        this.setData({ showBannerModal: true });
    },

    closeBannerModal() {
        this.setData({ showBannerModal: false });
    },

    selectBanner(e) {
        const banner = e.currentTarget.dataset.banner;
        this.setData({ 'formData.image': banner, showBannerModal: false });
    },

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

    // 模版选择相关方法
    async showTemplateSelector() {
        this.setData({ showTemplateModal: true, loadingTemplates: true });
        try {
            const data = await api.matches.list();
            // 获取最近10个活动
            const recent = data.slice(0, 10);
            this.setData({ recentActivities: recent });
        } catch (err) {
            console.error('获取活动列表失败:', err);
            wx.showToast({ title: '获取活动列表失败', icon: 'none' });
        } finally {
            this.setData({ loadingTemplates: false });
        }
    },

    closeTemplateModal() {
        this.setData({ showTemplateModal: false });
    },

    selectTemplate(e) {
        const template = e.currentTarget.dataset.template;

        // 解析 config_json
        let config = {};
        try {
            config = JSON.parse(template.config_json || '{}');
        } catch (err) {
            console.error('解析配置失败:', err);
        }

        const staticUrl = app.globalData.staticUrl;
        let descriptionImages = [];
        if (config.descriptionImages && Array.isArray(config.descriptionImages)) {
            descriptionImages = config.descriptionImages.map(img => 
                img.startsWith('http') ? img : staticUrl + img.replace('/sportsreg', '')
            );
        }

        // 复制指定字段
        this.setData({
            'formData.location': template.location || this.data.formData.location,
            'formData.maxPlayers': template.max_players || this.data.formData.maxPlayers,
            'formData.maxFieldPlayers': config.maxFieldPlayers || this.data.formData.maxFieldPlayers,
            'formData.maxWaitlist': config.maxWaitlist || this.data.formData.maxWaitlist,
            'formData.description': template.description || this.data.formData.description,
            'formData.descriptionImages': descriptionImages,
            'formData.rules': config.rules || this.data.formData.rules,
            'formData.organizer': config.organizer || this.data.formData.organizer,
            'formData.contactInfo': config.contactInfo || this.data.formData.contactInfo,
            'formData.proxyLimit': template.proxy_limit !== undefined ? template.proxy_limit : this.data.formData.proxyLimit,
            showTemplateModal: false
        });

        wx.showToast({ title: '已应用模版', icon: 'success' });
    },

    validateForm() {
        const errors = {};
        const { formData } = this.data;

        if (!formData.name || formData.name.length < 2) errors.name = '活动名称至少2个字符';
        if (!formData.startDateTime) errors.startDateTime = '请选择开始时间';
        if (!formData.endDateTime) errors.endDateTime = '请选择结束时间';
        if (!formData.location || formData.location.length < 2) errors.location = '请输入活动地点';
        if (!formData.description || formData.description.length < 5) errors.description = '活动描述至少5个字符';

        if (formData.status === 'pre-registration' && !formData.maxPlayers) {
            errors.maxPlayers = '预报名状态下，最大参与人数为必填';
        }
        if (formData.status === 'registration') {
            if (!formData.maxFieldPlayers) errors.maxFieldPlayers = '正式报名状态下，最大上场人数为必填';
        }
        if (formData.status === 'finished-pending' && !formData.totalCost) {
            errors.totalCost = '待结算状态下，总费用为必填';
        }

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
            const { formData } = this.data;
            const staticUrl = app.globalData.staticUrl;

            // 构建后端数据格式
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

            await api.matches.create(data);

            wx.showToast({ title: '创建成功', icon: 'success' });
            setTimeout(() => {
                wx.navigateBack({ delta: 1 });
            }, 1000);
        } catch (err) {
            wx.showToast({ title: err.error || '创建失败', icon: 'none' });
        } finally {
            this.setData({ isSubmitting: false });
        }
    },

    stopPropagation() { }
});
