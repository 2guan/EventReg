/**
 * 数据映射工具
 * 将后端数据格式转换为前端使用的格式
 */

const app = getApp();

/**
 * 将后端活动数据映射为前端格式
 * @param {object} match - 后端活动数据
 * @param {number} myRegistrationCount - 我的报名数量
 * @returns {object} 前端格式活动数据
 */
function mapBackendToFrontend(match, myRegistrationCount = 0) {
    // 解析配置JSON
    let config = {};
    try {
        config = JSON.parse(match.config_json || '{}');
    } catch (e) {
        console.error('解析config_json失败:', e);
    }

    // 服务器静态资源地址
    const staticUrl = app ? app.globalData.staticUrl : 'https://sportsreg.shenhaimujing.com/sportsreg';

    // 构建图片URL
    let imageUrl = config.image || '/sportsreg/banner/defaultbanner-01.jpg';
    if (imageUrl.startsWith('/sportsreg')) {
        imageUrl = staticUrl + imageUrl.replace('/sportsreg', '');
    }

    // 将后端数字状态映射为前端字符串状态
    const statusNumToString = {
        0: 'pre-registration',
        1: 'registration',
        2: 'waiting-list',
        3: 'full',
        4: 'finished-pending',
        5: 'finished-completed',
        6: 'cancelled'
    };

    // 获取状态
    let status = match.status;
    if (typeof status === 'number') {
        status = statusNumToString[status] || 'registration';
    }

    // 处理补充图片
    const descriptionImages = (config.descriptionImages || []).map(url => {
        if (url.startsWith('/sportsreg')) {
            return staticUrl + url.replace('/sportsreg', '');
        }
        return url;
    });

    // 计算开始和结束时间
    const startDateTimeRaw = config.start_datetime || config.startDateTime || match.time || '';
    let endDateTimeCalc = config.end_datetime || config.endDateTime || '';

    // 如果没有结束时间，通过duration计算
    if (!endDateTimeCalc && startDateTimeRaw) {
        try {
            const startMs = new Date(startDateTimeRaw.replace(' ', 'T')).getTime();
            const durationMins = Number(match.duration) || 90;
            const endMs = startMs + durationMins * 60000;
            const endDate = new Date(endMs);
            const year = endDate.getFullYear();
            const month = String(endDate.getMonth() + 1).padStart(2, '0');
            const day = String(endDate.getDate()).padStart(2, '0');
            const hours = String(endDate.getHours()).padStart(2, '0');
            const minutes = String(endDate.getMinutes()).padStart(2, '0');
            endDateTimeCalc = `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch (e) {
            endDateTimeCalc = '';
        }
    }

    return {
        id: String(match.id),
        name: match.title,
        description: match.description || '',
        descriptionImages: descriptionImages,

        // 时间相关
        date: match.time ? match.time.split(' ')[0] : '',
        startTime: config.start_time || (match.time ? match.time.split(' ')[1] : ''),
        endTime: config.end_time || '',
        startDateTime: startDateTimeRaw,
        endDateTime: endDateTimeCalc,
        duration: match.duration || 90,

        // 地点
        location: match.location,

        // 人数配置
        maxPlayers: match.max_players || 20,
        maxFieldPlayers: config.maxFieldPlayers || match.max_players,
        maxWaitlist: config.maxWaitlist || match.max_waitlist || 5,
        registeredCount: match.registered_count || 0,
        waitlistCount: match.waitlist_count || 0,
        myRegistrationCount: myRegistrationCount,

        // 费用
        totalCost: config.totalCost || 0,
        totalAmount: config.totalCost || 0,
        costNote: config.costNote || '',

        // 状态
        status: status,
        isPopular: config.isPopular || false,

        // 其他
        rules: config.rules || [],
        organizer: config.organizer || '',
        contactInfo: config.contactInfo || '',

        // 图片
        image: imageUrl,

        // 代报名限制
        proxyLimit: match.proxy_limit === undefined ? 2 : match.proxy_limit,

        // 公开状态
        visibility: match.visibility || 'public'
    };
}

/**
 * 将报名列表数据映射为参与者格式
 * @param {array} enrollments - 报名列表
 * @param {string} currentUserId - 当前用户ID
 * @returns {object} { players: [], waitingList: [] }
 */
function mapEnrollmentsToParticipants(enrollments, currentUserId, maxFieldPlayers) {
    const staticUrl = app ? app.globalData.staticUrl : 'https://sportsreg.shenhaimujing.com/sportsreg';
    const defaultAvatar = staticUrl + '/face/defaultface-user%20(1).jpg';

    // 按报名时间排序
    const sorted = [...enrollments].sort((a, b) => {
        // iOS 兼容：将 "yyyy-MM-dd HH:mm:ss" 格式转换为 "yyyy-MM-ddTHH:mm:ss" 格式
        const dateStrA = (a.created_at || '').replace(' ', 'T');
        const dateStrB = (b.created_at || '').replace(' ', 'T');
        const timeA = new Date(dateStrA || 0).getTime();
        const timeB = new Date(dateStrB || 0).getTime();
        if (timeA === timeB) {
            return parseInt(a.id) - parseInt(b.id);
        }
        return timeA - timeB;
    });

    // 映射为参与者对象
    const participants = sorted.map(e => {
        const isSelf = String(e.user_id) === String(currentUserId) && !e.enrolled_for_name;
        const isOwner = String(e.user_id) === String(currentUserId);

        // 处理头像URL
        let avatarUrl = e.avatar || defaultAvatar;
        if (avatarUrl.startsWith('/sportsreg')) {
            avatarUrl = staticUrl + avatarUrl.replace('/sportsreg', '');
        }

        return {
            id: String(e.id),
            name: e.enrolled_for_name || e.nickname,
            avatar: avatarUrl,
            isMe: isSelf,
            isOwner: isOwner,
            score: e.score,
            proxyName: e.enrolled_for_name ? e.nickname : null,
            joinedAt: e.created_at,
            userId: String(e.user_id),
            enrolledForName: e.enrolled_for_name
        };
    });

    // 根据maxFieldPlayers分割上场人员和候补人员
    const limit = maxFieldPlayers || participants.length;
    const players = participants.slice(0, limit);
    const waitingList = participants.slice(limit);

    return { players, waitingList };
}

/**
 * 获取状态文本
 * @param {string} status - 状态代码
 * @returns {string} 状态文本
 */
function getStatusText(status) {
    const statusMap = {
        'pre-registration': '预报名',
        'registration': '报名中',
        'waiting-list': '可候补',
        'full': '已满员',
        'finished': '已结束',
        'finished-pending': '待结算',
        'finished-completed': '已结束',
        'cancelled': '已取消'
    };
    return statusMap[status] || status;
}

/**
 * 获取状态样式类名
 * @param {string} status - 状态代码
 * @returns {string} 样式类名
 */
function getStatusClass(status) {
    const classMap = {
        'pre-registration': 'status-pre-registration',
        'registration': 'status-registration',
        'waiting-list': 'status-waiting-list',
        'full': 'status-full',
        'finished': 'status-finished',
        'finished-pending': 'status-finished-pending',
        'finished-completed': 'status-finished-completed',
        'cancelled': 'status-cancelled'
    };
    return classMap[status] || 'status-full';
}

module.exports = {
    mapBackendToFrontend,
    mapEnrollmentsToParticipants,
    getStatusText,
    getStatusClass
};
