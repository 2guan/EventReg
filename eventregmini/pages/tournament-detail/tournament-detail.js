/**
 * 活动详情页
 * 与网页版 TournamentDetail.tsx 完全一致
 * 这是最重要的页面，包含全部14个子模块
 */

const app = getApp();
const { api } = require('../../utils/api.js');
const mappers = require('../../utils/mappers.js');
const util = require('../../utils/util.js');
const { silentRequestSubscribe, requestSubscribe } = require('../../utils/subscribe.js');

Page({
    data: {
        theme: 'light',
        isAuthenticated: false,
        userInfo: null,
        tournamentId: '',
        tournament: null,
        players: [],
        waitingList: [],
        loading: true,

        // 状态文本和样式
        statusText: '',
        statusClass: '',
        formattedDateTime: '',

        // 报名按钮状态
        enrollButtonText: '',
        enrollButtonDisabled: false,
        canEnrollAsPlayer: false,
        canEnrollAsWaitlist: false,
        remainingSpots: 0,
        remainingWaitlist: 0,
        shouldShowEnrollButton: false, // 控制底部按钮是否显示

        // 我的报名信息
        myEnrollments: [],
        myTotalCost: '0.00',
        perPersonCost: '0.00',

        // 付款人分组列表 (网页版费用结算)
        payers: [],

        // 模态框状态
        showEnrollModal: false,
        showShareModal: false,
        showAdminAddModal: false,
        showAdminMenu: false,
        enrollForSelf: true,
        enrollForOtherName: '',
        adminAddName: '',
        adminAddType: 'player', // 'player' or 'waitlist'

        // 积分录入
        scores: {},
        isEditingScores: false,

        // 当前选中的参与者（用于管理员操作）
        selectedParticipant: null,

        // 分享图片路径
        shareImagePath: '',

        // 锁定状态 (0=未锁定, 1=基本锁定, 2=完全锁定)
        lockState: 0,

        // 提示框状态
        tipType: '',      // 'blue' | 'green' | 'orange' | 'gray' | ''
        tipIcon: '',
        tipTitle: '',
        tipDesc: '',

        // 代报名限制
        myProxyCount: 0,
        canProxy: true
    },

    // 格式化报名时间 (与网页版一致)
    formatJoinedAt(dateString) {
        if (!dateString) return '';
        // 处理SQLite UTC字符串
        let safeDateStr = dateString;
        if (typeof dateString === 'string' && !dateString.includes('T') && !dateString.includes('Z')) {
            safeDateStr = dateString.replace(' ', 'T') + 'Z';
        }
        const date = new Date(safeDateStr);
        // 格式化为 MM.DD HH:mm
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${month}.${day} ${hours}:${minutes}`;
    },

    onLoad(options) {
        this.setData({
            tournamentId: options.id,
            theme: app.globalData.theme,
            isAuthenticated: app.globalData.isAuthenticated,
            userInfo: app.globalData.userInfo
        });
    },

    onShow() {
        this.setData({
            theme: app.globalData.theme,
            isAuthenticated: app.globalData.isAuthenticated,
            userInfo: app.globalData.userInfo,
            isAdmin: app.globalData.userInfo?.role === 'admin'
        });
        app.updateNavigationBarColor(app.globalData.theme);
        this.fetchTournamentDetail();
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

    // 刷新消息中心
    refreshMessageCenter() {
        const messageCenter = this.selectComponent('#messageCenter');
        if (messageCenter && messageCenter.fetchNotifications) {
            // 延迟一点执行，等待后端处理完成
            setTimeout(() => {
                messageCenter.fetchNotifications();
            }, 500);
        }
    },

    // 获取活动详情（带缓存策略）
    async fetchTournamentDetail() {
        const tournamentId = this.data.tournamentId;
        const CACHE_KEY = `tournament_detail_${tournamentId}`;

        // 1. 先尝试从缓存读取数据，实现秒开
        try {
            const cachedData = wx.getStorageSync(CACHE_KEY);
            if (cachedData && cachedData.timestamp) {
                // 缓存有效期：3分钟（详情页需要更实时的数据）
                const isExpired = Date.now() - cachedData.timestamp > 3 * 60 * 1000;

                if (!isExpired) {
                    // 立即显示缓存数据
                    this.setData({
                        loading: false,
                        ...cachedData.pageData
                    });
                }
            }
        } catch (e) {
            console.warn('读取缓存失败:', e);
        }

        // 2. 后台获取最新数据
        try {
            // 获取活动信息
            const matchRes = await api.matches.get(tournamentId);
            const tournament = mappers.mapBackendToFrontend(matchRes);

            // 获取报名列表
            const enrollmentsRes = await api.enrollments.list(tournamentId);

            // 映射参与者
            // 预报名状态下不限制上场人数，所有报名者都是正式报名
            const isPreRegistration = tournament.status === 'pre-registration';
            const maxFieldPlayers = isPreRegistration ? Infinity : (tournament.maxFieldPlayers || tournament.maxPlayers);
            const { players, waitingList } = mappers.mapEnrollmentsToParticipants(
                enrollmentsRes,
                app.globalData.userInfo?.id,
                maxFieldPlayers
            );

            // 更新活动数据
            tournament.registeredCount = players.length;
            tournament.waitlistCount = waitingList.length;

            // 获取锁定状态 (0=未锁定, 1=基本锁定, 2=完全锁定)
            let lockStateValue = 0;
            try {
                const config = JSON.parse(matchRes.config_json || '{}');
                // 兼容旧数据：布尔值转换为数字
                lockStateValue = typeof config.locked === 'number' ? config.locked : (config.locked ? 1 : 0);
            } catch (e) { }

            // 计算我的报名
            const myEnrollments = [...players, ...waitingList].filter(p => p.isOwner);
            const myProxyCount = myEnrollments.filter(p => p.enrolledForName).length;
            const myInPlayers = players.filter(p => p.isOwner).length;
            // 用于判断费用结算显示权限: 只有上场人员(非候补)可以看到
            const myEnrollmentsInPlayers = players.filter(p => p.isOwner);
            
            // 是否还可以代报
            const limit = tournament.proxyLimit ?? 2;
            const canProxy = limit > 0 && myProxyCount < limit;

            // 计算费用 (向上取整,去掉小数点)
            let myTotalCost = '0';
            let perPersonCost = '0';
            if ((tournament.status === 'finished-pending' || tournament.status === 'finished-completed') && tournament.totalCost && players.length > 0) {
                const perPerson = tournament.totalCost / players.length;
                perPersonCost = Math.ceil(perPerson).toString();
                myTotalCost = Math.ceil(perPerson * myInPlayers).toString();
            }

            // 格式化显示数据
            const statusText = mappers.getStatusText(tournament.status);
            const statusClass = mappers.getStatusClass(tournament.status);
            const startDateTime = tournament.startDateTime || (tournament.date + ' ' + tournament.startTime);
            const endDateTime = tournament.endDateTime;
            const formattedDateTime = util.formatTournamentDateTime(startDateTime, endDateTime);

            // 计算报名按钮状态
            const {
                enrollButtonText,
                enrollButtonDisabled,
                canEnrollAsPlayer,
                canEnrollAsWaitlist,
                remainingSpots,
                remainingWaitlist
            } = this.calculateEnrollButtonState(tournament, players.length, waitingList.length, myEnrollments.length);

            // 计算是否显示底部报名按钮 (与网页版一致: 只在预报名/报名中/候补/已满时显示)
            const shouldShowEnrollButton = ['pre-registration', 'registration', 'waiting-list', 'full'].includes(tournament.status);

            // 初始化积分数据
            const scores = {};
            players.forEach(p => {
                scores[p.id] = p.score !== null && p.score !== undefined ? String(p.score) : '';
            });

            // 为参与者添加格式化后的报名时间和取消按钮显示状态
            const isAdmin = app.globalData.userInfo?.role === 'admin';
            const hasWaitlist = waitingList.length > 0;

            const playersWithTime = players.map(p => {
                // 计算是否显示取消按钮（上场人员）
                let canShowCancelButton = false;
                if (isAdmin) {
                    canShowCancelButton = true;
                } else if (p.isOwner) {
                    // 根据锁定状态判断
                    if (lockStateValue === 0) {
                        // 未锁定：允许取消
                        canShowCancelButton = true;
                    } else if (lockStateValue === 1) {
                        // 基本锁定：有候补时允许取消
                        canShowCancelButton = hasWaitlist;
                    } else if (lockStateValue === 2) {
                        // 完全锁定：上场人员不允许取消
                        canShowCancelButton = false;
                    }
                }
                return {
                    ...p,
                    formattedJoinedAt: this.formatJoinedAt(p.joinedAt),
                    canShowCancelButton
                };
            });
            const waitingListWithTime = waitingList.map(p => {
                // 候补人员的取消按钮逻辑：候补人员总是可以取消（包括完全锁定状态）
                let canShowCancelButton = isAdmin || p.isOwner;
                return {
                    ...p,
                    formattedJoinedAt: this.formatJoinedAt(p.joinedAt),
                    canShowCancelButton
                };
            });

            // 计算付款人分组列表 (与网页版费用结算一致, 向上取整)
            let payers = [];
            if ((tournament.status === 'finished-pending' || tournament.status === 'finished-completed') && tournament.totalCost && players.length > 0) {
                const unitCost = tournament.totalCost / players.length;
                const payerMap = {};

                players.forEach(p => {
                    if (!payerMap[p.userId]) {
                        payerMap[p.userId] = { info: p, count: 0 };
                    }
                    // 优先使用本人记录（非代报）
                    if (!p.enrolledForName && !p.proxyName) {
                        payerMap[p.userId].info = p;
                    }
                    payerMap[p.userId].count++;
                });

                payers = Object.values(payerMap).map(({ info, count }) => ({
                    userId: info.userId,
                    name: info.proxyName || info.name,
                    avatar: info.avatar,
                    isMe: info.isMe,
                    count: count,
                    totalCost: Math.ceil(unitCost * count).toString()
                }));
            }

            // 检查用户是否已经为自己报名
            const hasEnrolledForSelf = myEnrollments.some(e => !e.enrolledForName && !e.proxyName);

            // 计算提示框信息
            const tipInfo = this.calculateTipInfo(
                tournament,
                lockStateValue,
                myEnrollments.length > 0,
                waitingListWithTime.length > 0
            );

            // 构建页面数据对象
            const pageData = {
                tournament,
                players: playersWithTime,
                waitingList: waitingListWithTime,
                myEnrollments,
                myEnrollmentsInPlayers,
                myProxyCount,
                canProxy,
                hasEnrolledForSelf,
                myTotalCost,
                perPersonCost,
                payers,
                statusText,
                statusClass,
                formattedDateTime,
                enrollButtonText,
                enrollButtonDisabled,
                canEnrollAsPlayer,
                canEnrollAsWaitlist,
                remainingSpots,
                remainingWaitlist,
                shouldShowEnrollButton,
                scores,
                lockState: lockStateValue,
                hasEnrolledForSelf,
                ...tipInfo
            };

            // 3. 一次性更新所有数据
            this.setData({
                ...pageData,
                loading: false
            });

            // 4. 保存到缓存
            try {
                wx.setStorageSync(CACHE_KEY, {
                    timestamp: Date.now(),
                    pageData
                });
            } catch (e) {
                console.warn('保存缓存失败:', e);
            }

            // 预生成分享图片
            setTimeout(() => {
                this.preGenerateShareImage();
            }, 500);
        } catch (err) {
            console.error('获取活动详情失败:', err);
            wx.showToast({
                title: '加载失败',
                icon: 'none'
            });
            this.setData({ loading: false });
        }
    },

    // 计算提示框信息（基于北京时间）
    calculateTipInfo(tournament, lockState, hasEnrolled, hasWaitlist) {
        const status = tournament.status;
        let tipType = '';
        let tipIcon = '';
        let tipTitle = '';
        let tipDesc = '';

        // 计算距离活动开始的小时数（北京时间）
        let hoursUntilStart = Infinity;
        try {
            const startDateTimeStr = tournament.startDateTime || `${tournament.date} ${tournament.startTime}`;
            // 后端存储的是北京时间，直接解析
            let safeDateStr = startDateTimeStr;
            if (typeof startDateTimeStr === 'string' && !startDateTimeStr.includes('T')) {
                safeDateStr = startDateTimeStr.replace(' ', 'T');
            }
            // 假设后端时间是北京时间，添加+08:00时区标识
            if (!safeDateStr.includes('Z') && !safeDateStr.includes('+')) {
                safeDateStr += '+08:00';
            }
            const startTime = new Date(safeDateStr);
            const now = new Date();
            hoursUntilStart = (startTime - now) / (1000 * 60 * 60);
        } catch (e) {
            console.warn('计算活动开始时间失败:', e);
        }

        // 预报名或正式报名状态
        if (status === 'pre-registration' || status === 'registration') {
            if (lockState === 1) {
                // 基本锁定状态
                tipType = 'orange';
                tipIcon = '⚠️';
                tipTitle = '温馨提示';
                if (!hasEnrolled) {
                    // 未报名
                    tipDesc = '当前活动已临近开始时间，报名后，如无候补人员将无法取消。';
                } else if (hoursUntilStart > 4) {
                    // 已报名，距开始>4小时
                    tipDesc = '当前活动已临近开始，无候补人员时无法取消报名，请您按时参加。当上场人员取消报名时，候补人员将依序递补进入名单，请及时关注报名状态。';
                } else {
                    // 已报名，距开始≤4小时
                    tipDesc = '当前活动已临近开始，无候补人员时无法取消报名，请您按时参加。当上场人员取消报名时，候补人员将依序递补进入名单，请及时关注报名状态。';
                }
            } else if (lockState === 2) {
                // 完全锁定状态
                tipType = 'red';
                tipIcon = '🔒';
                tipTitle = '重要提示';
                tipDesc = '活动即将开始，名单已锁定，无法取消报名，如遇特殊情况请自行转让名额并与管理员沟通。';
            } else {
                // 未锁定状态 - 欢迎报名提示
                tipType = 'blue';
                tipIcon = 'ℹ️';
                tipTitle = '报名指南';
                tipDesc = '欢迎您报名参加活动，受系统限制，报名后，请您多次点击右上方的🔔订阅按钮以便收到报名状态变更和活动开始提醒消息。';
            }
        } else if (status === 'finished-pending') {
            // 待结算状态
            if (hasEnrolled) {
                tipType = 'green';
                tipIcon = '✅';
                tipTitle = '活动已完成';
                tipDesc = '您报名的活动已完成，请您留意活动结算及积分累积情况。（代报名人员无法累积积分）';
            } else {
                tipType = 'gray';
                tipIcon = '📢';
                tipTitle = '活动已结束';
                tipDesc = '活动已结束，请您关注下次活动。';
            }
        } else if (status === 'finished-completed') {
            // 已结束状态
            tipType = 'gray';
            tipIcon = '📢';
            tipTitle = '活动已结束';
            tipDesc = '活动已结束，请您关注下次活动。';
        }

        return { tipType, tipIcon, tipTitle, tipDesc };
    },

    // 循环切换锁定状态 (Admin Only): 0 -> 1 -> 2 -> 0
    async cycleLockState() {
        const isAdmin = this.data.userInfo?.role === 'admin';
        if (!isAdmin) return;

        const newLockState = (this.data.lockState + 1) % 3; // 0 -> 1 -> 2 -> 0
        try {
            await api.matches.toggleLock(this.data.tournamentId, newLockState);
            this.setData({ lockState: newLockState });
            const stateText = newLockState === 0 ? '未锁定' : newLockState === 1 ? '基本锁定' : '完全锁定';
            wx.showToast({
                title: `活动已设置为${stateText}`,
                icon: 'success'
            });
            this.fetchTournamentDetail(); // 刷新页面
        } catch (err) {
            console.error('切换锁定状态失败:', err);
            wx.showToast({
                title: err.error || '操作失败',
                icon: 'none'
            });
        }
    },

    // 发送开始提醒 (Admin Only)
    async sendStartReminder() {
        const isAdmin = this.data.userInfo?.role === 'admin';
        if (!isAdmin) return;

        // 确认对话框
        const confirmResult = await new Promise(resolve => {
            wx.showModal({
                title: '发送开始提醒',
                content: `确定要向所有上场人员（${this.data.players.length}人）发送开始提醒吗？`,
                confirmText: '确定发送',
                cancelText: '取消',
                success: (res) => resolve(res.confirm)
            });
        });

        if (!confirmResult) return;

        // 显示加载提示
        wx.showLoading({
            title: '发送中...',
            mask: true
        });

        try {
            const result = await api.matches.sendStartReminder(this.data.tournamentId);
            wx.hideLoading();

            wx.showToast({
                title: result.message || '发送成功',
                icon: 'success',
                duration: 2000
            });

            console.log(`[START REMINDER] Sent to ${result.sentCount}/${result.totalPlayers} players`);
        } catch (err) {
            wx.hideLoading();
            console.error('发送开始提醒失败:', err);
            wx.showToast({
                title: err.error || '发送失败',
                icon: 'none',
                duration: 2000
            });
        }
    },

    // 判断是否应隐藏取消按钮 (非管理员, 锁定, 无候补)
    shouldHideCancelButton(participant) {
        const isAdmin = this.data.userInfo?.role === 'admin';
        // 管理员始终可以操作
        if (isAdmin) return false;
        // 不是自己的报名
        if (!participant.isOwner) return true;
        // 活动未锁定
        if (!this.data.isLocked) return false;
        // 活动已锁定，但有候补人员
        if (this.data.waitingList.length > 0) return false;
        // 活动已锁定，且无候补人员
        return true;
    },

    // 计算报名按钮状态
    calculateEnrollButtonState(tournament, playerCount, waitlistCount, myCount) {
        const status = tournament.status;
        const maxPlayers = tournament.maxPlayers;
        const maxFieldPlayers = tournament.maxFieldPlayers || maxPlayers;
        const maxWaitlist = tournament.maxWaitlist || 5;

        let enrollButtonText = '报名';
        let enrollButtonDisabled = false;
        let canEnrollAsPlayer = false;
        let canEnrollAsWaitlist = false;
        let remainingSpots = 0;
        let remainingWaitlist = 0;

        if (status === 'pre-registration') {
            remainingSpots = maxPlayers - playerCount - waitlistCount;
            if (remainingSpots > 0) {
                enrollButtonText = `预报名 (剩余${remainingSpots}个名额)(含候补)`;
                canEnrollAsPlayer = true;
            } else {
                enrollButtonText = '当前预报名已满';
                enrollButtonDisabled = true;
            }
        } else if (status === 'registration') {
            remainingSpots = maxFieldPlayers - playerCount;
            remainingWaitlist = maxWaitlist - waitlistCount;

            if (remainingSpots > 0) {
                enrollButtonText = `报名 (剩余${remainingSpots}个名额)`;
                canEnrollAsPlayer = true;
            } else if (remainingWaitlist > 0) {
                enrollButtonText = `报名已满，还可以候补${remainingWaitlist}人`;
                canEnrollAsWaitlist = true;
            } else {
                enrollButtonText = '当前报名已满';
                enrollButtonDisabled = true;
            }
        } else {
            enrollButtonText = '报名已结束';
            enrollButtonDisabled = true;
        }

        return {
            enrollButtonText,
            enrollButtonDisabled,
            canEnrollAsPlayer,
            canEnrollAsWaitlist,
            remainingSpots,
            remainingWaitlist
        };
    },

    // 显示报名模态框
    showEnrollModal() {
        if (!app.globalData.isAuthenticated) {
            wx.navigateTo({ url: '/pages/login/login' });
            return;
        }

        if (app.globalData.userInfo?.status === 'pending') {
            wx.showToast({
                title: '您的账号正在审核中',
                icon: 'none'
            });
            return;
        }

        // 如果用户已经为自己报名，自动选中"为他人报名"
        const hasEnrolledForSelf = this.data.hasEnrolledForSelf;

        const limit = this.data.tournament.proxyLimit ?? 2;
        if (limit === 0) {
            this.setData({
                showEnrollModal: true,
                enrollForSelf: true
            });
            return;
        }

        this.setData({
            showEnrollModal: true,
            enrollForSelf: !this.data.myEnrollments.some(e => !e.enrolledForName)
        });
    },

    // 关闭报名模态框
    closeEnrollModal() {
        this.setData({ showEnrollModal: false });
    },

    // 切换报名类型
    onEnrollTypeChange(e) {
        const wantSelf = e.currentTarget.dataset.self;
        // 如果用户已经为自己报名，不允许选择"为自己报名"
        if (wantSelf && this.data.myEnrollments.some(en => !en.enrolledForName)) {
            return;
        }
        // 如果不允许代报或已达上限
        if (!wantSelf && (!this.data.canProxy || this.data.tournament?.proxyLimit === 0)) {
            return;
        }
        this.setData({ enrollForSelf: wantSelf });
    },

    // 输入代报名姓名
    onEnrollNameInput(e) {
        this.setData({ enrollForOtherName: e.detail.value });
    },

    // 确认报名
    async confirmEnroll() {
        const { enrollForSelf, enrollForOtherName, tournamentId } = this.data;

        if (!enrollForSelf && !enrollForOtherName.trim()) {
            wx.showToast({
                title: '请输入代报名姓名',
                icon: 'none'
            });
            return;
        }

        try {
            wx.showLoading({ title: '报名中...' });

            const data = {
                match_id: parseInt(tournamentId)
            };

            if (!enrollForSelf) {
                data.enrolled_for_name = enrollForOtherName.trim();
            }

            await api.enrollments.join(data);

            wx.hideLoading();
            wx.showToast({
                title: '报名成功',
                icon: 'success'
            });

            // 报名成功后请求订阅消息授权（先检查系统设置是否开启微信推送）
            try {
                const wxPushRes = await api.settings.getWxPush();
                console.log('[Enroll] wx_push_enabled:', wxPushRes.enabled);
                if (wxPushRes.enabled) {
                    console.log('[Enroll] Requesting subscription...');
                    // 注意：微信要求订阅必须由用户点击触发，在API回调中调用可能无法弹窗
                    const subResult = await requestSubscribe();
                    console.log('[Enroll] Subscription result:', subResult);
                } else {
                    console.log('[Enroll] WeChat push is disabled, skip subscription request');
                }
            } catch (err) {
                console.log('[Enroll] Failed to check wx_push setting:', err);
            }

            this.closeEnrollModal();
            this.fetchTournamentDetail();
        } catch (err) {
            wx.hideLoading();
            wx.showToast({
                title: err.error || '报名失败',
                icon: 'none'
            });
        }
    },

    // 点击参与者头像（取消报名）
    onTapParticipant(e) {
        const participant = e.currentTarget.dataset.participant;
        const isAdmin = app.globalData.userInfo?.role === 'admin';

        // 检查是否可以取消
        if (participant.isOwner || isAdmin) {
            this.setData({
                selectedParticipant: participant,
                showAdminMenu: true
            });
        }
    },

    // 关闭管理员菜单
    closeAdminMenu() {
        this.setData({
            showAdminMenu: false,
            selectedParticipant: null
        });
    },

    // 取消报名
    async cancelEnrollment() {
        const { selectedParticipant } = this.data;
        if (!selectedParticipant) return;

        const confirmed = await app.showModal('确认取消', `确定要取消${selectedParticipant.name}的报名吗？`);
        if (!confirmed) return;

        try {
            wx.showLoading({ title: '处理中...' });
            await api.enrollments.cancel(selectedParticipant.id);

            wx.hideLoading();
            wx.showToast({
                title: '已取消报名',
                icon: 'success'
            });

            this.closeAdminMenu();
            this.fetchTournamentDetail();
            this.refreshMessageCenter();
        } catch (err) {
            wx.hideLoading();
            wx.showToast({
                title: err.error || '操作失败',
                icon: 'none'
            });
        }
    },

    // 显示分享模态框
    showShareModal() {
        this.setData({ showShareModal: true });
    },

    // 关闭分享模态框
    closeShareModal() {
        this.setData({ showShareModal: false });
    },

    // 预览描述图片
    previewDescImage(e) {
        const url = e.currentTarget.dataset.url;
        const urls = this.data.tournament.descriptionImages || [];
        wx.previewImage({
            current: url,
            urls: urls
        });
    },

    // 显示管理员添加人员模态框
    showAdminAddModal() {
        this.setData({
            showAdminAddModal: true,
            adminAddName: '',
            adminAddType: 'player'
        });
    },

    // 关闭管理员添加模态框
    closeAdminAddModal() {
        this.setData({ showAdminAddModal: false });
    },

    // 输入添加人员姓名
    onAdminAddNameInput(e) {
        this.setData({ adminAddName: e.detail.value });
    },

    // 切换添加类型
    onAdminAddTypeChange(e) {
        this.setData({ adminAddType: e.currentTarget.dataset.type });
    },

    // 确认添加人员（管理员）
    async confirmAdminAdd() {
        const { adminAddName, adminAddType, tournamentId, players } = this.data;

        if (!adminAddName.trim()) {
            wx.showToast({
                title: '请输入姓名',
                icon: 'none'
            });
            return;
        }

        try {
            wx.showLoading({ title: '添加中...' });

            // 计算 customCreatedAt：第一个报名人员的时间 - 1秒
            let customCreatedAt = undefined;
            if (players && players.length > 0) {
                // 找到最早的 joinedAt 时间
                const timestamps = players.map(p => {
                    if (p.joinedAt) {
                        // 处理日期格式，确保能正确解析
                        let dateStr = p.joinedAt;
                        if (!dateStr.includes('T')) {
                            dateStr = dateStr.replace(' ', 'T');
                        }
                        if (!dateStr.includes('Z') && !dateStr.includes('+')) {
                            dateStr += 'Z';
                        }
                        return new Date(dateStr).getTime();
                    }
                    return Date.now();
                });

                const minTime = Math.min(...timestamps);
                const newTime = minTime - 1000; // 1秒前

                // 格式化为后端需要的格式: "YYYY-MM-DD HH:mm:ss"
                const d = new Date(newTime);
                customCreatedAt = d.toISOString().replace('T', ' ').substring(0, 19);
            }

            await api.enrollments.join({
                match_id: parseInt(tournamentId),
                enrolled_for_name: adminAddName.trim(),
                as_type: adminAddType,
                created_at: customCreatedAt
            });

            wx.hideLoading();
            wx.showToast({
                title: '添加成功',
                icon: 'success'
            });

            this.closeAdminAddModal();
            this.fetchTournamentDetail();
            this.refreshMessageCenter();
        } catch (err) {
            wx.hideLoading();
            wx.showToast({
                title: err.error || '添加失败',
                icon: 'none'
            });
        }
    },

    // 积分输入
    onScoreInput(e) {
        const id = e.currentTarget.dataset.id;
        const value = e.detail.value;
        this.setData({
            [`scores.${id}`]: value
        });
    },

    // 一键给所有人相同积分
    onQuickScore() {
        wx.showModal({
            title: '一键积分',
            editable: true,
            placeholderText: '请输入积分值',
            success: (res) => {
                if (res.confirm && res.content) {
                    const score = res.content.trim();
                    const scores = {};
                    this.data.players.forEach(p => {
                        scores[p.id] = score;
                    });
                    this.setData({ scores });
                }
            }
        });
    },

    // 保存积分
    async saveScores() {
        const { scores, players } = this.data;

        const scoreList = players.map(p => ({
            id: parseInt(p.id),
            score: parseFloat(scores[p.id]) || 0
        }));

        try {
            wx.showLoading({ title: '保存中...' });
            await api.enrollments.updateScores(scoreList);

            wx.hideLoading();
            wx.showToast({
                title: '保存成功',
                icon: 'success'
            });

            this.setData({ isEditingScores: false });
            this.fetchTournamentDetail();
        } catch (err) {
            wx.hideLoading();
            wx.showToast({
                title: err.error || '保存失败',
                icon: 'none'
            });
        }
    },

    // 切换积分编辑模式
    toggleEditScores() {
        this.setData({ isEditingScores: !this.data.isEditingScores });
    },

    // 辅助方法：绘制圆角矩形
    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.arcTo(x + width, y, x + width, y + radius, radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
        ctx.lineTo(x + radius, y + height);
        ctx.arcTo(x, y + height, x, y + height - radius, radius);
        ctx.lineTo(x, y + radius);
        ctx.arcTo(x, y, x + radius, y, radius);
        ctx.closePath();
    },

    // 预生成分享图片
    async preGenerateShareImage() {
        try {
            const imagePath = await this.generateShareImage();
            if (imagePath) {
                this.setData({ shareImagePath: imagePath });
            }
        } catch (err) {
            console.error('预生成分享图片失败:', err);
        }
    },

    // 生成分享图片
    async generateShareImage() {
        return new Promise((resolve, reject) => {
            const tournament = this.data.tournament;
            if (!tournament) {
                reject(new Error('No tournament data'));
                return;
            }

            const query = wx.createSelectorQuery();
            query.select('#shareCanvas')
                .fields({ node: true, size: true })
                .exec(async (res) => {
                    if (!res[0] || !res[0].node) {
                        resolve(tournament.image || '');
                        return;
                    }

                    const canvas = res[0].node;
                    const ctx = canvas.getContext('2d');
                    const dpr = wx.getWindowInfo().pixelRatio;

                    const width = 280;
                    const height = 225;
                    canvas.width = width * dpr;
                    canvas.height = height * dpr;
                    ctx.scale(dpr, dpr);

                    // 绘制白色背景
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, width, height);

                    // 绘制圆角边框
                    ctx.strokeStyle = '#e5e7eb';
                    ctx.lineWidth = 1;
                    this.roundRect(ctx, 0.5, 0.5, width - 1, height - 1, 0);
                    ctx.stroke();

                    // Banner区域
                    const bannerHeight = 53;
                    try {
                        if (tournament.image) {
                            const img = canvas.createImage();
                            await new Promise((imgResolve, imgReject) => {
                                img.onload = () => {
                                    ctx.save();
                                    ctx.beginPath();
                                    ctx.moveTo(12, 0);
                                    ctx.lineTo(width - 12, 0);
                                    ctx.arcTo(width, 0, width, 12, 0);
                                    ctx.lineTo(width, bannerHeight);
                                    ctx.lineTo(0, bannerHeight);
                                    ctx.lineTo(0, 12);
                                    ctx.arcTo(0, 0, 12, 0, 0);
                                    ctx.closePath();
                                    ctx.clip();
                                    ctx.drawImage(img, 0, 0, width, bannerHeight);
                                    ctx.restore();
                                    imgResolve();
                                };
                                img.onerror = imgReject;
                                img.src = tournament.image;
                            });
                        } else {
                            ctx.save();
                            this.roundRect(ctx, 0, 0, width, bannerHeight, 12);
                            ctx.clip();
                            const gradient = ctx.createLinearGradient(0, 0, width, bannerHeight);
                            gradient.addColorStop(0, '#ef4444');
                            gradient.addColorStop(1, '#fb923c');
                            ctx.fillStyle = gradient;
                            ctx.fillRect(0, 0, width, bannerHeight);
                            ctx.restore();
                        }
                    } catch (e) {
                        ctx.save();
                        this.roundRect(ctx, 0, 0, width, bannerHeight, 12);
                        ctx.clip();
                        const gradient = ctx.createLinearGradient(0, 0, width, bannerHeight);
                        gradient.addColorStop(0, '#ef4444');
                        gradient.addColorStop(1, '#fb923c');
                        ctx.fillStyle = gradient;
                        ctx.fillRect(0, 0, width, bannerHeight);
                        ctx.restore();
                    }

                    // 状态标签
                    const statusColors = {
                        'pre-registration': { bg: '#dbeafe', text: '#1e40af' },
                        'registration': { bg: '#dcfce7', text: '#166534' },
                        'waiting-list': { bg: '#fef9c3', text: '#854d0e' },
                        'full': { bg: '#f3f4f6', text: '#1f2937' },
                        'finished-pending': { bg: '#ffedd5', text: '#9a3412' },
                        'finished-completed': { bg: '#e0e7ff', text: '#3730a3' },
                        'cancelled': { bg: '#fee2e2', text: '#991b1b' }
                    };
                    const statusStyle = statusColors[tournament.status] || { bg: '#f3f4f6', text: '#374151' };
                    const statusLabel = this.data.statusText;

                    ctx.font = 'bold 11px sans-serif';
                    const statusWidth = ctx.measureText(statusLabel).width + 16;
                    ctx.fillStyle = statusStyle.bg;
                    this.roundRect(ctx, width - statusWidth - 10, 10, statusWidth, 22, 11);
                    ctx.fill();
                    ctx.fillStyle = statusStyle.text;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(statusLabel, width - statusWidth / 2 - 10, 21);

                    // 内容区域
                    const contentY = bannerHeight + 18;

                    ctx.font = 'bold 20px sans-serif';
                    ctx.fillStyle = '#111827';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                    const title = tournament.name || '';
                    const maxTitleLen = 14;
                    const displayTitle = title.length > maxTitleLen ? title.slice(0, maxTitleLen) + '...' : title;
                    ctx.fillText(displayTitle, 14, contentY);

                    ctx.font = '13px sans-serif';
                    ctx.fillStyle = '#6b7280';
                    ctx.fillText('📅 ' + this.data.formattedDateTime, 14, contentY + 36);

                    const location = tournament.location || '';
                    const maxLocLen = 18;
                    const displayLoc = location.length > maxLocLen ? location.slice(0, maxLocLen) + '...' : location;
                    ctx.fillText('📍 ' + displayLoc, 14, contentY + 58);

                    // 底部统计框
                    const statsY = height - 58;
                    const status = tournament.status;

                    if (status === 'pre-registration') {
                        const fullBoxWidth = width - 24;
                        ctx.fillStyle = '#dbeafe';
                        this.roundRect(ctx, 12, statsY, fullBoxWidth, 40, 8);
                        ctx.fill();
                        ctx.fillStyle = '#1e40af';
                        ctx.font = '10px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillText('预报名人数', width / 2, statsY + 6);
                        ctx.font = 'bold 14px sans-serif';
                        const preRegCount = tournament.registeredCount || 0;
                        ctx.fillText(String(preRegCount), width / 2, statsY + 22);
                    } else if (status === 'registration' || status === 'waiting-list' || status === 'full') {
                        const boxWidth = (width - 36) / 2;
                        ctx.fillStyle = '#dcfce7';
                        this.roundRect(ctx, 12, statsY, boxWidth, 40, 8);
                        ctx.fill();
                        ctx.fillStyle = '#166534';
                        ctx.font = '10px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillText('报名人数', 12 + boxWidth / 2, statsY + 6);
                        ctx.font = 'bold 14px sans-serif';
                        const regText = `${tournament.registeredCount || 0}/${tournament.maxFieldPlayers || tournament.maxPlayers || 20}`;
                        ctx.fillText(regText, 12 + boxWidth / 2, statsY + 22);

                        ctx.fillStyle = '#fef9c3';
                        this.roundRect(ctx, 24 + boxWidth, statsY, boxWidth, 40, 8);
                        ctx.fill();
                        ctx.fillStyle = '#854d0e';
                        ctx.font = '10px sans-serif';
                        ctx.fillText('候补人数', 24 + boxWidth + boxWidth / 2, statsY + 6);
                        ctx.font = 'bold 14px sans-serif';
                        const waitText = `${tournament.waitlistCount || 0}/${tournament.maxWaitlist || 5}`;
                        ctx.fillText(waitText, 24 + boxWidth + boxWidth / 2, statsY + 22);
                    } else {
                        const fullBoxWidth = width - 24;
                        ctx.fillStyle = '#f3f4f6';
                        this.roundRect(ctx, 12, statsY, fullBoxWidth, 40, 8);
                        ctx.fill();
                        ctx.fillStyle = '#374151';
                        ctx.font = '10px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillText('报名人数', width / 2, statsY + 6);
                        ctx.font = 'bold 14px sans-serif';
                        const regCount = tournament.registeredCount || 0;
                        ctx.fillText(String(regCount), width / 2, statsY + 22);
                    }

                    // 导出图片
                    wx.canvasToTempFilePath({
                        canvas: canvas,
                        success: (res) => {
                            resolve(res.tempFilePath);
                        },
                        fail: (err) => {
                            console.error('Canvas to temp file failed:', err);
                            resolve(tournament.image || '');
                        }
                    });
                });
        });
    },

    // 分享
    onShareAppMessage() {
        const { tournament, shareImagePath } = this.data;
        return {
            title: tournament?.name || '活动详情',
            path: `/pages/tournament-detail/tournament-detail?id=${this.data.tournamentId}`,
            imageUrl: shareImagePath || tournament?.image
        };
    },

    // 手动订阅推送
    async handleSubscribe() {
        // 先检查微信推送是否开启
        try {
            const wxPushRes = await api.settings.getWxPush();
            if (!wxPushRes.enabled) {
                wx.showToast({
                    title: '管理员未开启微信推送',
                    icon: 'none'
                });
                return;
            }
        } catch (err) {
            console.log('[Subscribe] Failed to check wx_push setting:', err);
        }

        // 请求订阅（微信每次只能授权1次）
        const result = await requestSubscribe();

        if (result.accepted) {
            wx.showToast({
                title: `订阅成功，剩余${result.total || 1}次`,
                icon: 'success'
            });
        } else if (result.error) {
            wx.showToast({
                title: '请在设置中开启订阅消息',
                icon: 'none'
            });
        } else {
            wx.showToast({
                title: '已取消订阅',
                icon: 'none'
            });
        }
    },

    // 复制下载链接
    handleCopyDownloadLink() {
        const downloadUrl = `${app.globalData.baseUrl}/enrollments/${this.data.tournamentId}/export`;

        wx.setClipboardData({
            data: downloadUrl,
            success: () => {
                wx.showToast({
                    title: '下载链接已复制',
                    icon: 'success'
                });
            },
            fail: () => {
                wx.showToast({
                    title: '复制失败',
                    icon: 'none'
                });
            }
        });
    },

    // 阻止冒泡
    stopPropagation() { }
});
