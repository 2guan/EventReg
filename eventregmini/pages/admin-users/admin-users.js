/**
 * 用户管理页面
 * 与网页版 AdminUsers.tsx 完全一致
 */

const app = getApp();
const { api } = require('../../utils/api.js');

Page({
    data: {
        theme: 'light',
        users: [],
        filteredUsers: [],
        loading: true,
        searchTerm: '',

        // 模态框状态
        showModal: false,
        showSettingsModal: false,
        selectedUser: null,
        actionType: null, // 'edit_profile', 'add_points', 'deduct_points'
        modalTitle: '',

        // 编辑表单
        editNickname: '',
        editRole: 'user',
        editPassword: '',
        editAvatar: '',
        showAvatarSelection: false,
        roleOptions: [
            { label: '正式用户', value: 'user' },
            { label: '管理员', value: 'admin' },
            { label: '待审核', value: 'pending' }
        ],
        roleIndex: 0,

        // 积分调整
        pointsDiff: '',

        // 注册设置
        defaultRole: 'pending',

        // 头像列表
        avatars: []
    },

    onLoad() {
        this.initPage();
    },

    onShow() {
        this.setData({ theme: app.globalData.theme });
        app.updateNavigationBarColor(app.globalData.theme);
        this.fetchUsers();
    },

    initPage() {
        const staticUrl = app.globalData.staticUrl;
        const avatars = [];
        for (let i = 1; i <= 30; i++) {
            avatars.push(`${staticUrl}/face/defaultface-user%20(${i}).jpg`);
        }
        this.setData({
            theme: app.globalData.theme,
            avatars
        });
    },

    toggleTheme() {
        const newTheme = app.toggleTheme();
        this.setData({ theme: newTheme });
    },

    goBack() {
        wx.navigateBack({ delta: 1 });
    },

    stopPropagation() { },

    // 获取用户列表
    async fetchUsers() {
        this.setData({ loading: true });
        try {
            const res = await api.users.list();
            const staticUrl = app.globalData.staticUrl;
            const defaultAvatar = staticUrl + '/face/defaultface-user%20(1).jpg';

            const users = (res || []).map(u => {
                let avatar = u.avatar || defaultAvatar;
                if (avatar.startsWith('/sportsreg')) {
                    avatar = staticUrl + avatar.replace('/sportsreg', '');
                }

                // 角色文本和样式
                let roleText = '正式用户';
                let roleClass = 'user';
                if (u.role === 'admin') {
                    roleText = '管理员';
                    roleClass = 'admin';
                } else if (u.role === 'pending') {
                    roleText = '待审核';
                    roleClass = 'pending';
                }

                return { ...u, avatar, roleText, roleClass };
            });

            this.setData({ users });
            this.filterUsers();
        } catch (err) {
            wx.showToast({ title: '加载失败', icon: 'none' });
        } finally {
            this.setData({ loading: false });
        }
    },

    // 搜索输入
    onSearchInput(e) {
        this.setData({ searchTerm: e.detail.value });
        this.filterUsers();
    },

    // 过滤用户
    filterUsers() {
        const { users, searchTerm } = this.data;
        const term = searchTerm.toLowerCase();

        const filteredUsers = users.filter(u =>
            (u.nickname || '').toLowerCase().includes(term) ||
            (u.username || '').toLowerCase().includes(term)
        );

        this.setData({ filteredUsers });
    },

    // 打开操作模态框
    openAction(e) {
        const user = e.currentTarget.dataset.user;
        const action = e.currentTarget.dataset.action;

        let modalTitle = '';
        if (action === 'edit_profile') {
            modalTitle = '编辑用户信息';
        } else if (action === 'add_points') {
            modalTitle = '增加积分';
        } else if (action === 'deduct_points') {
            modalTitle = '扣除积分';
        }

        // 初始化编辑值
        let roleIndex = 0;
        if (user.role === 'admin') roleIndex = 1;
        else if (user.role === 'pending') roleIndex = 2;

        this.setData({
            showModal: true,
            selectedUser: user,
            actionType: action,
            modalTitle,
            editNickname: user.nickname || '',
            editRole: user.role || 'user',
            editPassword: '',
            editAvatar: user.avatar || this.data.avatars[0],
            roleIndex,
            showAvatarSelection: false,
            pointsDiff: ''
        });
    },

    // 关闭模态框
    closeModal() {
        this.setData({
            showModal: false,
            selectedUser: null,
            actionType: null
        });
    },

    // 切换头像选择
    toggleAvatarSelection() {
        this.setData({ showAvatarSelection: !this.data.showAvatarSelection });
    },

    // 选择头像
    selectAvatar(e) {
        const avatar = e.currentTarget.dataset.avatar;
        this.setData({
            editAvatar: avatar,
            showAvatarSelection: false
        });
    },

    // 输入昵称
    onNicknameInput(e) {
        this.setData({ editNickname: e.detail.value });
    },

    // 选择角色
    onRoleChange(e) {
        const index = e.detail.value;
        this.setData({
            roleIndex: index,
            editRole: this.data.roleOptions[index].value
        });
    },

    // 输入密码
    onPasswordInput(e) {
        this.setData({ editPassword: e.detail.value });
    },

    // 输入积分差值
    onPointsDiffInput(e) {
        this.setData({ pointsDiff: e.detail.value });
    },

    // 保存操作
    async handleSave() {
        const { selectedUser, actionType, editNickname, editRole, editPassword, editAvatar, pointsDiff } = this.data;

        if (!selectedUser || !actionType) return;

        try {
            if (actionType === 'edit_profile') {
                wx.showLoading({ title: '保存中...' });

                const payload = {
                    nickname: editNickname,
                    role: editRole,
                    avatar: editAvatar
                };
                if (editPassword) {
                    payload.password = editPassword;
                }

                await api.users.update(selectedUser.id, payload);
                wx.hideLoading();
                wx.showToast({ title: '更新成功', icon: 'success' });

            } else if (actionType === 'add_points' || actionType === 'deduct_points') {
                const val = parseInt(pointsDiff);
                if (isNaN(val) || val <= 0) {
                    wx.showToast({ title: '请输入有效的积分数值', icon: 'none' });
                    return;
                }

                wx.showLoading({ title: '处理中...' });
                const adjustment = actionType === 'add_points' ? val : -val;
                await api.users.updatePoints(selectedUser.id, adjustment, '管理员调整');
                wx.hideLoading();
                wx.showToast({ title: '积分调整成功', icon: 'success' });
            }

            this.closeModal();
            this.fetchUsers();
        } catch (err) {
            wx.hideLoading();
            wx.showToast({ title: err.error || '操作失败', icon: 'none' });
        }
    },

    // 删除用户
    async deleteUser() {
        const { selectedUser } = this.data;
        if (!selectedUser) return;

        const confirmed = await app.showModal('确认删除', `确定要永久删除用户 "${selectedUser.nickname}" 吗？此操作不可恢复！`);
        if (!confirmed) return;

        try {
            wx.showLoading({ title: '删除中...' });
            await api.users.delete(selectedUser.id);
            wx.hideLoading();
            wx.showToast({ title: '用户已删除', icon: 'success' });
            this.closeModal();
            this.fetchUsers();
        } catch (err) {
            wx.hideLoading();
            wx.showToast({ title: err.error || '删除失败', icon: 'none' });
        }
    },

    // 打开设置
    async openSettings() {
        try {
            const data = await api.settings.getRegistration();
            this.setData({
                showSettingsModal: true,
                defaultRole: data.default_role || 'pending'
            });
        } catch (err) {
            wx.showToast({ title: '获取设置失败', icon: 'none' });
        }
    },

    // 关闭设置模态框
    closeSettingsModal() {
        this.setData({ showSettingsModal: false });
    },

    // 选择默认角色
    selectDefaultRole(e) {
        const role = e.currentTarget.dataset.role;
        this.setData({ defaultRole: role });
    },

    // 保存设置
    async saveSettings() {
        try {
            wx.showLoading({ title: '保存中...' });
            await api.settings.updateRegistration({ default_role: this.data.defaultRole });
            wx.hideLoading();
            wx.showToast({ title: '设置已保存', icon: 'success' });
            this.closeSettingsModal();
        } catch (err) {
            wx.hideLoading();
            wx.showToast({ title: '保存失败', icon: 'none' });
        }
    }
});
