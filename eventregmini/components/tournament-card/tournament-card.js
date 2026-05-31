/**
 * 活动卡片组件
 * 与网页版 TournamentCard.tsx 完全一致
 */

const util = require('../../utils/util.js');
const mappers = require('../../utils/mappers.js');

const app = getApp();

Component({
    properties: {
        // 活动数据
        tournament: {
            type: Object,
            value: {}
        },
        // 索引（用于动画延迟）
        index: {
            type: Number,
            value: 0
        },
        // 是否已报名
        isEnrolled: {
            type: Boolean,
            value: false
        },
        // 自定义状态标签
        customStatusLabel: {
            type: String,
            value: ''
        },
        // 是否包含自己报名
        isSelfEnrolled: {
            type: Boolean,
            value: false
        },
        // 代报名人数
        proxyCount: {
            type: Number,
            value: 0
        },
        // 主题
        theme: {
            type: String,
            value: 'light'
        }
    },

    data: {
        formattedDateTime: '',
        statusText: '',
        statusClass: '',
        consumptionValue: '0',
        shareImagePath: ''
    },

    lifetimes: {
        attached() {
            this.updateDisplayData();
        },
        ready() {
            // 组件ready后生成分享图片
            setTimeout(() => {
                this.preGenerateShareImage();
            }, 500);
        }
    },

    observers: {
        'tournament': function (tournament) {
            if (tournament && tournament.id) {
                this.updateDisplayData();
                // 数据更新后重新生成分享图片
                setTimeout(() => {
                    this.preGenerateShareImage();
                }, 500);
            }
        }
    },

    methods: {
        // 预先生成分享图片
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

        // 更新显示数据
        updateDisplayData() {
            const tournament = this.properties.tournament;
            if (!tournament) return;

            // 格式化日期时间
            const startDateTime = tournament.startDateTime || (tournament.date + ' ' + tournament.startTime);
            const endDateTime = tournament.endDateTime || (tournament.date + ' ' + tournament.endTime);
            const formattedDateTime = util.formatTournamentDateTime(startDateTime, endDateTime);

            // 获取状态
            const statusText = mappers.getStatusText(tournament.status);
            const statusClass = mappers.getStatusClass(tournament.status);

            // 计算本次花费 (向上取整,去掉小数点)
            let consumptionValue = '0';
            if (tournament.totalAmount && tournament.myRegistrationCount) {
                // 上场人员数 = 取实际报名数和上场限制的最小值
                const maxField = tournament.maxFieldPlayers || tournament.maxPlayers || 0;
                const actualPlayers = Math.min(tournament.registeredCount || 0, maxField);

                if (actualPlayers > 0) {
                    const value = (tournament.totalAmount / actualPlayers) * tournament.myRegistrationCount;
                    consumptionValue = Math.ceil(value).toString();
                }
            }

            this.setData({
                formattedDateTime,
                statusText,
                statusClass,
                consumptionValue
            });
        },

        // 点击卡片跳转到详情页
        onTapCard() {
            const tournament = this.properties.tournament;
            if (tournament && tournament.id) {
                wx.navigateTo({
                    url: `/pages/tournament-detail/tournament-detail?id=${tournament.id}`
                });
            }
        },

        // 准备分享（阻止事件冒泡）
        onPrepareShare(e) {
            // 阻止冒泡，不跳转到详情页
        },

        // 生成分享图片
        async generateShareImage() {
            return new Promise((resolve, reject) => {
                const tournament = this.properties.tournament;
                if (!tournament) {
                    reject(new Error('No tournament data'));
                    return;
                }

                const query = this.createSelectorQuery();
                query.select('#shareCanvas')
                    .fields({ node: true, size: true })
                    .exec(async (res) => {
                        if (!res[0] || !res[0].node) {
                            // Canvas 不存在，使用默认图片
                            resolve(tournament.image || '');
                            return;
                        }

                        const canvas = res[0].node;
                        const ctx = canvas.getContext('2d');
                        const dpr = wx.getWindowInfo().pixelRatio;

                        // 设置canvas尺寸 - 用户要求280x230
                        const width = 280;
                        const height = 225;
                        canvas.width = width * dpr;
                        canvas.height = height * dpr;
                        ctx.scale(dpr, dpr);

                        // 绘制白色背景
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, width, height);

                        // 绘制圆角矩形边框
                        ctx.strokeStyle = '#e5e7eb';
                        ctx.lineWidth = 1;
                        this.roundRect(ctx, 0.5, 0.5, width - 1, height - 1, 0);
                        ctx.stroke();

                        // 尝试加载banner图片 - 16:3比例，宽度280时高度约53
                        const bannerHeight = 53;
                        try {
                            if (tournament.image) {
                                const img = canvas.createImage();
                                await new Promise((imgResolve, imgReject) => {
                                    img.onload = () => {
                                        // 绘制圆角banner区域
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
                                // 没有图片时使用渐变背景
                                ctx.save();
                                ctx.beginPath();
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
                            // 图片加载失败，使用渐变背景
                            ctx.save();
                            ctx.beginPath();
                            this.roundRect(ctx, 0, 0, width, bannerHeight, 12);
                            ctx.clip();
                            const gradient = ctx.createLinearGradient(0, 0, width, bannerHeight);
                            gradient.addColorStop(0, '#ef4444');
                            gradient.addColorStop(1, '#fb923c');
                            ctx.fillStyle = gradient;
                            ctx.fillRect(0, 0, width, bannerHeight);
                            ctx.restore();
                        }

                        // 绘制状态标签 - 与活动card颜色一致
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

                        // 绘制内容区域 - 增加上边距让布局更宽松
                        const contentY = bannerHeight + 18;

                        // 绘制标题 - 字号略大
                        ctx.font = 'bold 20px sans-serif';
                        ctx.fillStyle = '#111827';
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'top';
                        const title = tournament.name || '';
                        const maxTitleLen = 14;
                        const displayTitle = title.length > maxTitleLen ? title.slice(0, maxTitleLen) + '...' : title;
                        ctx.fillText(displayTitle, 14, contentY);

                        // 绘制日期时间 - 增加行间距
                        ctx.font = '13px sans-serif';
                        ctx.fillStyle = '#6b7280';
                        ctx.fillText('📅 ' + this.data.formattedDateTime, 14, contentY + 36);

                        // 绘制地点 - 增加行间距
                        const location = tournament.location || '';
                        const maxLocLen = 18;
                        const displayLoc = location.length > maxLocLen ? location.slice(0, maxLocLen) + '...' : location;
                        ctx.fillText('📍 ' + displayLoc, 14, contentY + 58);

                        // 绘制底部统计框 - 根据状态显示不同内容
                        const statsY = height - 58;
                        const status = tournament.status;

                        if (status === 'pre-registration') {
                            // 预报名状态：显示浅蓝色预报名人数框（全宽）
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
                            // 正式报名状态：显示报名人数框 + 候补人数框
                            const boxWidth = (width - 36) / 2;

                            // 报名人数框
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

                            // 候补人数框
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
                            // 待结算、已取消、已完成状态：只显示报名人数（全宽）
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

        // 绘制圆角矩形
        roundRect(ctx, x, y, w, h, r) {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
        },

        // 计算本次花费 (向上取整,去掉小数点)
        calculateConsumptionValue() {
            const tournament = this.properties.tournament;
            if (!tournament.totalAmount || !tournament.myRegistrationCount) {
                return '0';
            }
            // 上场人员数 = 取实际报名数和上场限制的最小值
            const maxField = tournament.maxFieldPlayers || tournament.maxPlayers || 0;
            const actualPlayers = Math.min(tournament.registeredCount || 0, maxField);

            if (actualPlayers <= 0) {
                return '0';
            }
            const value = (tournament.totalAmount / actualPlayers) * tournament.myRegistrationCount;
            return Math.ceil(value).toString();
        }
    }
});
