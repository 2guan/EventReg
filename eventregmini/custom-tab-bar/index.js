Component({
    data: {
        selected: 0,
        theme: 'light',
        list: [
            {
                pagePath: "/pages/home/home",
                text: "首页",
                icon: "weui-icon-home"
            },
            {
                pagePath: "/pages/tournaments/tournaments",
                text: "全部活动",
                icon: "weui-icon-calendar"
            },
            {
                pagePath: "/pages/my-scores/my-scores",
                text: "我的",
                icon: "weui-icon-user"
            }
        ]
    },

    attached() {
        // 获取当前主题
        const app = getApp();
        if (app && app.globalData) {
            this.setData({
                theme: app.globalData.theme || 'light'
            });
        }
    },

    methods: {
        switchTab(e) {
            const data = e.currentTarget.dataset;
            const url = data.path;

            wx.switchTab({
                url: url
            });
        },

        // 更新主题
        updateTheme(theme) {
            this.setData({ theme });
        },

        // 更新选中项
        updateSelected(index) {
            this.setData({ selected: index });
        }
    }
});
