/**
 * 消息中心组件
 * 与网页版 MessageCenter.tsx 完全一致
 */

const { api } = require('../../utils/api.js');
const util = require('../../utils/util.js');

Component({
    properties: {
        theme: {
            type: String,
            value: 'light'
        }
    },

    data: {
        isOpen: false,
        notifications: [],
        unreadCount: 0
    },

    lifetimes: {
        attached() {
            this.fetchNotifications();
        }
    },

    pageLifetimes: {
        show() {
            this.fetchNotifications();
        }
    },

    methods: {
        // 获取通知列表
        async fetchNotifications() {
            try {
                const res = await api.notifications.list();
                const notifications = (res || []).map(n => ({
                    ...n,
                    formattedTime: this.formatNotificationTime(n.created_at)
                }));

                // 计算未读数量
                const unreadCount = notifications.filter(n => !n.is_read).length;

                this.setData({
                    notifications: notifications,
                    unreadCount: unreadCount
                });
            } catch (err) {
                console.error('获取通知失败:', err);
            }
        },

        // 格式化通知时间 - 北京时间，格式："12月15日 17:28:05"
        formatNotificationTime(dateString) {
            if (!dateString) return '';

            try {
                // 数据库存储的是UTC时间，格式 "YYYY-MM-DD HH:MM:SS"
                let safeDate = dateString;
                if (safeDate && !safeDate.includes('T') && !safeDate.includes('Z')) {
                    safeDate = safeDate.replace(' ', 'T') + 'Z';
                }

                const date = new Date(safeDate);
                // 转换为北京时间 (UTC+8)
                const beijingOffset = 8 * 60 * 60 * 1000;
                const utcTime = date.getTime() + (date.getTimezoneOffset() * 60 * 1000);
                const beijingTime = new Date(utcTime + beijingOffset);

                const month = beijingTime.getMonth() + 1;
                const day = beijingTime.getDate();
                const hours = String(beijingTime.getHours()).padStart(2, '0');
                const minutes = String(beijingTime.getMinutes()).padStart(2, '0');
                const seconds = String(beijingTime.getSeconds()).padStart(2, '0');

                return `${month}月${day}日 ${hours}:${minutes}:${seconds}`;
            } catch (e) {
                return dateString;
            }
        },

        // 切换消息中心显示状态
        toggleOpen() {
            const isOpen = !this.data.isOpen;
            this.setData({ isOpen });

            if (isOpen) {
                this.fetchNotifications();
            }
        },

        // 关闭消息中心
        close() {
            this.setData({ isOpen: false });
        },

        // 标记单条已读
        async markAsRead(e) {
            const id = e.currentTarget.dataset.id;
            const isRead = e.currentTarget.dataset.isRead;

            // 如果已读，不做任何操作
            if (isRead) return;

            try {
                await api.notifications.markAsRead(id);

                // 更新本地状态
                const notifications = this.data.notifications.map(n =>
                    n.id === id ? { ...n, is_read: 1 } : n
                );
                this.setData({
                    notifications: notifications,
                    unreadCount: Math.max(0, this.data.unreadCount - 1)
                });
            } catch (err) {
                console.error('标记已读失败:', err);
            }
        },

        // 全部已读
        async markAllRead() {
            try {
                await api.notifications.markAllRead();

                // 更新本地状态
                const notifications = this.data.notifications.map(n => ({ ...n, is_read: 1 }));
                this.setData({
                    notifications: notifications,
                    unreadCount: 0
                });

                wx.showToast({
                    title: '全部已读',
                    icon: 'success'
                });
            } catch (err) {
                wx.showToast({
                    title: '操作失败',
                    icon: 'none'
                });
            }
        },

        // 全部删除
        async deleteAll() {
            wx.showModal({
                title: '确认删除',
                content: '确定要删除所有消息吗？',
                success: async (res) => {
                    if (res.confirm) {
                        try {
                            await api.notifications.deleteAll();

                            this.setData({
                                notifications: [],
                                unreadCount: 0
                            });

                            wx.showToast({
                                title: '全部已删除',
                                icon: 'success'
                            });
                        } catch (err) {
                            wx.showToast({
                                title: '删除失败',
                                icon: 'none'
                            });
                        }
                    }
                }
            });
        },

        // 删除单条通知
        async deleteNotification(e) {
            const id = e.currentTarget.dataset.id;

            try {
                await api.notifications.delete(id);

                const deletedNotification = this.data.notifications.find(n => n.id === id);
                const notifications = this.data.notifications.filter(n => n.id !== id);

                // 如果删除的是未读消息，减少未读计数
                const unreadChange = deletedNotification && !deletedNotification.is_read ? 1 : 0;

                this.setData({
                    notifications: notifications,
                    unreadCount: Math.max(0, this.data.unreadCount - unreadChange)
                });

                wx.showToast({
                    title: '消息已删除',
                    icon: 'success'
                });
            } catch (err) {
                wx.showToast({
                    title: '删除失败',
                    icon: 'none'
                });
            }
        },

        // 阻止冒泡
        stopPropagation() {
            // 空函数，用于阻止点击事件冒泡
        }
    }
});
